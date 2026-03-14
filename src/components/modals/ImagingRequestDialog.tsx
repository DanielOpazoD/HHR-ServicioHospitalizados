import React from 'react';
import { FileText, ClipboardList, Printer, ShieldCheck } from 'lucide-react';
import { BaseModal } from '@/components/shared/BaseModal';
import { ImagingRequestDialogProps, DocumentTypeOption } from './imaging/types';
import { useImagingLogic } from './imaging/useImagingLogic';
import { ImagingSidebar } from './imaging/ImagingSidebar';
import { ImagingViewer } from './imaging/ImagingViewer';

export const ImagingRequestDialog: React.FC<ImagingRequestDialogProps> = ({
  isOpen,
  onClose,
  patient,
}) => {
  const {
    selectedDoc,
    setSelectedDoc,
    requestingPhysician,
    setRequestingPhysician,
    debouncedPhysician,
    marks,
    setMarks,
    isPrinting,
    toolMode,
    setToolMode,
    activeText,
    setActiveText,
    handlePrint,
    handleCanvasClick,
    handleUndoMark,
  } = useImagingLogic({ isOpen, patient });

  if (!isOpen) return null;

  const documents: DocumentTypeOption[] = [
    {
      id: 'solicitud',
      title: 'Formulario Solicitud',
      subtitle: 'Con autocompletado y marcado interactivo',
      icon: FileText,
      disabled: false,
    },
    {
      id: 'encuesta',
      title: 'Encuesta Medio Contraste',
      subtitle: 'Con autocompletado y marcado interactivo',
      icon: ClipboardList,
      disabled: false,
    },
    {
      id: 'consentimiento',
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
      headerActions={
        <button
          onClick={handlePrint}
          disabled={isPrinting}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-1.5 rounded-lg text-sm font-bold transition-all shadow-sm active:scale-95 group"
        >
          <Printer
            size={16}
            className={isPrinting ? 'animate-bounce' : 'group-hover:rotate-12 transition-transform'}
          />
          <span>{isPrinting ? 'Preparando...' : 'Imprimir'}</span>
        </button>
      }
      size="full"
    >
      <div className="flex h-[calc(100vh-116px)] w-full gap-3 pb-2">
        <ImagingSidebar
          documents={documents}
          selectedDoc={selectedDoc}
          setSelectedDoc={setSelectedDoc}
          requestingPhysician={requestingPhysician}
          setRequestingPhysician={setRequestingPhysician}
          toolMode={toolMode}
          setToolMode={setToolMode}
          marks={marks}
          handleUndoMark={handleUndoMark}
        />
        <ImagingViewer
          currentDocObj={currentDocObj}
          selectedDoc={selectedDoc}
          patient={patient}
          debouncedPhysician={debouncedPhysician}
          handleCanvasClick={handleCanvasClick}
          marks={marks}
          setMarks={setMarks}
          activeText={activeText}
          setActiveText={setActiveText}
        />
      </div>
    </BaseModal>
  );
};
