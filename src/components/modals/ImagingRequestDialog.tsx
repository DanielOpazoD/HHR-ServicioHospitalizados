import React, { useState, useEffect } from 'react';
import { FileText, ClipboardList, ShieldCheck, Printer, Target, Undo2, Type } from 'lucide-react';
import type { PatientData } from '@/types';
import {
  printImagingRequestForm,
  printImagingEncuestaForm,
  printConsentimientoForm,
  CustomMark,
} from '@/services/pdf/imagingRequestPdfService';
import {
  splitPatientName,
  calculateAge,
  formatDateToCL as formatDate,
} from '@/utils/clinicalUtils';
import { BaseModal } from '@/components/shared/BaseModal';

interface ImagingRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientData;
}

type DocumentOption = 'solicitud' | 'encuesta' | 'consentimiento';

const getTodayFormatted = (): string => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

export const ImagingRequestDialog: React.FC<ImagingRequestDialogProps> = ({
  isOpen,
  onClose,
  patient,
}) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentOption>('solicitud');
  const [requestingPhysician, setRequestingPhysician] = useState('');
  const [debouncedPhysician, setDebouncedPhysician] = useState('');
  const [marks, setMarks] = useState<CustomMark[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [toolMode, setToolMode] = useState<'cross' | 'text'>('cross');
  const [activeText, setActiveText] = useState<{ x: number; y: number; text: string } | null>(null);

  // Debounce the physician name input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedPhysician(requestingPhysician);
    }, 300);
    return () => clearTimeout(timer);
  }, [requestingPhysician]);

  // Cleanup when closing
  useEffect(() => {
    if (!isOpen) {
      setMarks([]);
      setIsPrinting(false);
      setToolMode('cross');
      setActiveText(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const [nombres, primerApellido, segundoApellido] = splitPatientName(patient.patientName);
  const todayStr = getTodayFormatted();
  const ageStr = calculateAge(patient.birthDate);
  const birthStr = formatDate(patient.birthDate);
  const diagValue = patient.pathology || patient.cie10Description || '';

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      if (selectedDoc === 'solicitud') {
        await printImagingRequestForm(patient, debouncedPhysician, marks);
      } else if (selectedDoc === 'encuesta') {
        await printImagingEncuestaForm(patient, debouncedPhysician, marks);
      } else if (selectedDoc === 'consentimiento') {
        await printConsentimientoForm(patient, debouncedPhysician, marks);
      }
    } catch (err) {
      console.error('[ImagingDialog] Error printing:', err);
    } finally {
      // Re-enable button quickly
      setIsPrinting(false);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      selectedDoc !== 'solicitud' &&
      selectedDoc !== 'encuesta' &&
      selectedDoc !== 'consentimiento'
    )
      return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (toolMode === 'cross') {
      setMarks(prev => [...prev, { x, y }]);
      setActiveText(null); // Clear any active text if they switch mode or click away
    } else {
      // Text mode adds a temporary input field
      setActiveText({ x, y, text: '' });
    }
  };

  const handleUndoMark = () => {
    setMarks(prev => prev.slice(0, -1));
  };

  const documents = [
    {
      id: 'solicitud' as const,
      title: 'Formulario Solicitud',
      subtitle: 'Con autocompletado y marcado interactivo',
      icon: FileText,
      disabled: false,
    },
    {
      id: 'encuesta' as const,
      title: 'Encuesta Medio Contraste',
      subtitle: 'Con autocompletado y marcado interactivo',
      icon: ClipboardList,
      disabled: false,
    },
    {
      id: 'consentimiento' as const,
      title: 'Consentimiento Informado',
      subtitle: 'Documento legal para procedimientos',
      icon: ShieldCheck,
      disabled: false,
    },
  ];

  const currentDocObj = documents.find(d => d.id === selectedDoc);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      printable={false} // Custom printing
      title={
        <div className="flex items-center gap-2 pr-8">
          <FileText size={22} className="text-blue-600" />
          <span className="text-lg font-bold">Solicitud de Imágenes</span>
          <span className="text-slate-400 font-normal ml-2">
            {patient.patientName} {patient.rut ? `(${patient.rut})` : ''}
          </span>
        </div>
      }
      size="full"
    >
      <div className="flex h-[calc(100vh-140px)] w-full gap-4 pb-4">
        {/* Sidebar Navigation */}
        <div className="w-80 flex-shrink-0 bg-white border border-slate-200 rounded-xl p-4 flex flex-col h-full overflow-y-auto">
          {/* Physician Input */}
          <div className="mb-4">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1 mb-2 block">
              Médico Solicitante
            </label>
            <input
              type="text"
              placeholder="Nombre y Apellido"
              value={requestingPhysician}
              onChange={e => setRequestingPhysician(e.target.value)}
              className="w-full text-sm p-3 rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="h-px bg-slate-100 my-2"></div>

          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest px-2 mb-2 mt-2">
            Documentos Disponibles
          </h3>

          <div className="flex flex-col gap-2 mb-4">
            {documents.map(doc => {
              const Icon = doc.icon;
              const isSelected = selectedDoc === doc.id;

              return (
                <button
                  key={doc.id}
                  onClick={() => !doc.disabled && setSelectedDoc(doc.id)}
                  disabled={doc.disabled}
                  className={`
                                        w-full text-left p-3 rounded-lg border flex items-start gap-3 transition-all duration-200
                                        ${
                                          doc.disabled
                                            ? 'opacity-50 cursor-not-allowed border-transparent bg-slate-50'
                                            : isSelected
                                              ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                                              : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-slate-50'
                                        }
                                    `}
                >
                  <div
                    className={`p-2 rounded-lg mt-0.5 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`font-semibold text-sm ${isSelected ? 'text-blue-900' : 'text-slate-700'}`}
                    >
                      {doc.title}
                    </p>
                    <p
                      className={`text-xs mt-0.5 ${isSelected ? 'text-blue-700/80' : 'text-slate-500'}`}
                    >
                      {doc.subtitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-auto pt-4 border-t border-slate-100">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 flex flex-col gap-2">
              <h4 className="flex items-center gap-2 text-sm font-bold text-blue-900">
                <Target size={16} /> Marcado Interactivo
              </h4>
              <p className="text-xs text-blue-800 leading-relaxed">
                Haz clic en el formulario a la derecha para agregar cruces (
                <span className="font-bold">X</span>) o texto libre. Éstas se imprimirán en el
                documento final.
              </p>

              <div className="flex gap-2 mt-1 mb-1">
                <button
                  onClick={() => setToolMode('cross')}
                  className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${toolMode === 'cross' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  <Target size={12} /> Cruz (X)
                </button>
                <button
                  onClick={() => setToolMode('text')}
                  className={`flex-1 py-1.5 px-2 rounded flex items-center justify-center gap-1.5 text-xs font-bold transition-colors ${toolMode === 'text' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                >
                  <Type size={12} /> Texto
                </button>
              </div>
              {marks.length > 0 && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-700">{marks.length} marcas</span>
                  <button
                    onClick={handleUndoMark}
                    className="text-xs bg-white hover:bg-red-50 text-red-600 border border-red-200 hover:border-red-300 px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors font-medium shadow-sm"
                  >
                    <Undo2 size={12} /> Deshacer
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Viewer Area */}
        <div className="flex-1 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex flex-col">
          {/* Viewer Header Toolbar */}
          <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-10">
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-slate-800">{currentDocObj?.title}</h3>
            </div>

            <button
              onClick={handlePrint}
              disabled={isPrinting}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95 group"
            >
              <Printer
                size={16}
                className={
                  isPrinting ? 'animate-bounce' : 'group-hover:rotate-12 transition-transform'
                }
              />
              <span>{isPrinting ? 'Preparando...' : 'Imprimir Directo'}</span>
            </button>
          </div>

          {/* Interactive Canvas Viewer */}
          <div className="flex-1 relative bg-slate-200/50 overflow-y-auto">
            <div className="min-h-full flex items-center justify-center p-4 py-8">
              <div
                className="relative w-full max-w-[800px] mx-auto bg-white shadow-xl rounded-sm overflow-hidden cursor-crosshair select-none"
                onClick={handleCanvasClick}
                style={{
                  aspectRatio:
                    selectedDoc === 'solicitud'
                      ? '612 / 936'
                      : selectedDoc === 'consentimiento'
                        ? '612 / 842'
                        : '612 / 792',
                }}
              >
                <img
                  src={
                    selectedDoc === 'solicitud'
                      ? '/docs/solicitud_imagenologia.png'
                      : selectedDoc === 'encuesta'
                        ? '/docs/encuesta_imagenologia.png'
                        : '/docs/consentimiento.png'
                  }
                  alt="Base del Formulario"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />

                {selectedDoc === 'solicitud' && (
                  <>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '19.21%', top: '16.87%' }}
                    >
                      {nombres}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '32.86%', top: '16.87%' }}
                    >
                      {primerApellido}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '45.01%', top: '16.87%' }}
                    >
                      {segundoApellido}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '9.88%', top: '18.38%' }}
                    >
                      {patient.rut}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '37.54%', top: '18.38%' }}
                    >
                      {ageStr}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '77.28%', top: '18.38%' }}
                    >
                      {birthStr}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none font-medium truncate"
                      style={{ left: '21.51%', top: '20.24%', maxWidth: '33%' }}
                    >
                      {diagValue}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '22.72%', top: '14.71%' }}
                    >
                      {todayStr}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none font-bold"
                      style={{ left: '51.47%', top: '85.61%' }}
                    >
                      {debouncedPhysician}
                    </div>
                  </>
                )}

                {selectedDoc === 'encuesta' && (
                  <>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '16.27%', top: '17.12%' }}
                    >
                      {nombres}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '27.20%', top: '17.12%' }}
                    >
                      {primerApellido}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '41.74%', top: '17.12%' }}
                    >
                      {segundoApellido}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '69.14%', top: '17.12%' }}
                    >
                      {patient.rut}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '58.67%', top: '17.12%' }}
                    >
                      {ageStr}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none"
                      style={{ left: '26.95%', top: '24.52%' }}
                    >
                      {birthStr}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none font-medium truncate"
                      style={{ left: '18.35%', top: '37.24%', maxWidth: '40%' }}
                    >
                      {diagValue}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none font-bold"
                      style={{ left: '66.83%', top: '20.80%' }}
                    >
                      {debouncedPhysician}
                    </div>
                  </>
                )}

                {selectedDoc === 'consentimiento' && (
                  <>
                    <div
                      className="absolute font-sans text-xs sm:text-[10px] text-black pointer-events-none"
                      style={{ left: '31.65%', top: '21.7%' }}
                    >
                      {nombres}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-[10px] text-black pointer-events-none"
                      style={{ left: '48.67%', top: '21.7%' }}
                    >
                      {primerApellido}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-[10px] text-black pointer-events-none"
                      style={{ left: '62.72%', top: '21.7%' }}
                    >
                      {segundoApellido}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-[10px] text-black pointer-events-none"
                      style={{ left: '21.99%', top: '24.4%' }}
                    >
                      {patient.rut}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-[10px] text-black pointer-events-none"
                      style={{ left: '52.79%', top: '24.4%' }}
                    >
                      {ageStr}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-[10px] text-black pointer-events-none font-medium truncate"
                      style={{ left: '23.98%', top: '27.92%', maxWidth: '33%' }}
                    >
                      {diagValue}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-[10px] text-black pointer-events-none"
                      style={{ left: '69.81%', top: '16.76%' }}
                    >
                      {todayStr}
                    </div>
                    <div
                      className="absolute font-sans text-xs sm:text-[10px] text-black pointer-events-none font-bold"
                      style={{ left: '24.45%', top: '80.07%' }}
                    >
                      {debouncedPhysician}
                    </div>
                  </>
                )}

                {/* Active Text Input */}
                {activeText && (
                  <input
                    autoFocus
                    type="text"
                    value={activeText.text}
                    onChange={e =>
                      setActiveText(prev => (prev ? { ...prev, text: e.target.value } : null))
                    }
                    onBlur={() => {
                      if (activeText.text.trim()) {
                        setMarks(prev => [
                          ...prev,
                          { x: activeText.x, y: activeText.y, text: activeText.text },
                        ]);
                      }
                      // Wait slightly so any consecutive click can register properly
                      setTimeout(() => setActiveText(null), 100);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.currentTarget.blur();
                      }
                    }}
                    // onClick propagation stop to prevent double triggering canvas wrap
                    onClick={e => e.stopPropagation()}
                    className="absolute font-sans text-xs sm:text-sm text-black bg-white/90 border-b border-blue-500 outline-none transform -translate-y-1/2 uppercase px-1 py-0.5 shadow-sm focus:ring-1 focus:ring-blue-500 rounded-sm z-20"
                    style={{ left: `${activeText.x}%`, top: `${activeText.y}%`, width: '180px' }}
                  />
                )}

                {/* Marks */}
                {marks.map((mark, i) => (
                  <div
                    key={i}
                    className={`absolute pointer-events-none transform -translate-y-1/2 z-10 ${mark.text ? 'font-sans text-xs sm:text-sm text-black uppercase whitespace-nowrap' : '-translate-x-1/2 font-bold text-blue-700 flex items-center justify-center'}`}
                    style={{
                      left: `${mark.x}%`,
                      top: `${mark.y}%`,
                      fontSize: mark.text ? undefined : '1.2rem',
                      lineHeight: 1,
                    }}
                  >
                    {mark.text ? mark.text.toUpperCase() : 'X'}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
};
