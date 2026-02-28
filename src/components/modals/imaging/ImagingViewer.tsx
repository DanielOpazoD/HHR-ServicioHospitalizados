import React from 'react';
import { Printer } from 'lucide-react';
import { DocumentOption, DocumentTypeOption, ActiveTextMark } from './types';
import { CustomMark } from '@/services/pdf/imagingRequestPdfService';
import type { PatientData } from '@/types';
import {
  splitPatientName,
  calculateAge,
  formatDateToCL as formatDate,
} from '@/utils/clinicalUtils';

interface ImagingViewerProps {
  currentDocObj: DocumentTypeOption | undefined;
  selectedDoc: DocumentOption;
  patient: PatientData;
  debouncedPhysician: string;
  isPrinting: boolean;
  handlePrint: () => void;
  handleCanvasClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  marks: CustomMark[];
  setMarks: React.Dispatch<React.SetStateAction<CustomMark[]>>;
  activeText: ActiveTextMark | null;
  setActiveText: React.Dispatch<React.SetStateAction<ActiveTextMark | null>>;
}

export const ImagingViewer: React.FC<ImagingViewerProps> = ({
  currentDocObj,
  selectedDoc,
  patient,
  debouncedPhysician,
  isPrinting,
  handlePrint,
  handleCanvasClick,
  marks,
  setMarks,
  activeText,
  setActiveText,
}) => {
  const [nombres, primerApellido, segundoApellido] = splitPatientName(patient.patientName);

  const getTodayFormatted = (): string => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const todayStr = getTodayFormatted();
  const ageStr = calculateAge(patient.birthDate);
  const birthStr = formatDate(patient.birthDate);
  const diagValue = patient.pathology || patient.cie10Description || '';

  return (
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
            className={isPrinting ? 'animate-bounce' : 'group-hover:rotate-12 transition-transform'}
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
                  className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none font-medium whitespace-nowrap"
                  style={{ left: '21.51%', top: '20.24%' }}
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
                  className="absolute font-sans text-xs sm:text-sm text-black pointer-events-none font-medium whitespace-nowrap"
                  style={{ left: '18.35%', top: '37.24%' }}
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
                  className="absolute font-sans text-xs sm:text-[10px] text-black pointer-events-none font-medium whitespace-nowrap"
                  style={{ left: '23.98%', top: '27.92%' }}
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
  );
};
