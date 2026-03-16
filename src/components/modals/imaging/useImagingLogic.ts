import { useState, useEffect } from 'react';
import type { PatientData } from '@/types/domain/patient';
import {
  printImagingRequestForm,
  printImagingEncuestaForm,
  printConsentimientoForm,
  CustomMark,
} from '@/services/pdf/imagingRequestPdfService';
import { DocumentOption, ActiveTextMark } from './types';

interface UseImagingLogicProps {
  isOpen: boolean;
  patient: PatientData;
}

export const useImagingLogic = ({ isOpen, patient }: UseImagingLogicProps) => {
  const [selectedDoc, setSelectedDoc] = useState<DocumentOption>('solicitud');
  const [requestingPhysician, setRequestingPhysician] = useState('');
  const [debouncedPhysician, setDebouncedPhysician] = useState('');
  const [marks, setMarks] = useState<CustomMark[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [toolMode, setToolMode] = useState<'cross' | 'text'>('cross');
  const [activeText, setActiveText] = useState<ActiveTextMark | null>(null);

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

  return {
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
  };
};
