import React, { useState, useCallback, useMemo } from 'react';
import { FlaskConical } from 'lucide-react';
import { BaseModal } from '@/components/shared/BaseModal';
import { searchSyslabExams, fetchSyslabExamDetails } from '@/services/laboratory/syslabService';
import type { SyslabExamItem, SyslabExamDetail } from '@/types/domain/laboratory';
import {
  LabViewerControls,
  LabViewerProgress,
  LabViewerExamList,
  LabViewerResults,
  LabViewerPdf,
  LabViewerEmptyState,
} from '@/components/modals/LabResultsViewerModalContent';

interface LabPatient {
  bedId: string;
  label: string;
  patientName: string;
  rut: string;
  diagnosis?: string;
}

interface LabResultsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: LabPatient[];
  initialPatientRut?: string;
}

export const LabResultsViewerModal: React.FC<LabResultsViewerModalProps> = ({
  isOpen,
  onClose,
  patients,
  initialPatientRut,
}) => {
  const [selectedRut, setSelectedRut] = useState(initialPatientRut || patients[0]?.rut || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [examList, setExamList] = useState<SyslabExamItem[]>([]);
  const [examDetails, setExamDetails] = useState<SyslabExamDetail[]>([]);
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ pct: number; text: string } | null>(null);
  const [pdfExam, setPdfExam] = useState<SyslabExamItem | null>(null);

  // Deduplicate patients by RUT
  const uniquePatients = useMemo(() => {
    const seen = new Set<string>();
    return patients.filter(p => {
      if (!p.rut || seen.has(p.rut)) return false;
      seen.add(p.rut);
      return true;
    });
  }, [patients]);

  // Progress bar animation
  React.useEffect(() => {
    const active = isLoading || isLoadingDetails;
    if (!active) {
      if (progress) {
        setProgress({ pct: 100, text: '¡Completado!' });
        const timeout = setTimeout(() => setProgress(null), 600);
        return () => clearTimeout(timeout);
      }
      return;
    }

    const steps = isLoadingDetails
      ? [
          { pct: 10, text: 'Conectando con Syslab...' },
          { pct: 30, text: 'Abriendo informes PDF...' },
          { pct: 50, text: 'Extrayendo datos de laboratorio...' },
          { pct: 70, text: 'Parseando resultados...' },
          { pct: 85, text: 'Estructurando por secciones...' },
        ]
      : [
          { pct: 10, text: 'Conectando con servidor de laboratorio...' },
          { pct: 30, text: 'Iniciando sesión en Syslab...' },
          { pct: 50, text: 'Buscando exámenes del paciente...' },
          { pct: 70, text: 'Extrayendo lista de órdenes...' },
          { pct: 85, text: 'Procesando resultados...' },
        ];

    let step = 0;
    setProgress({ pct: steps[0].pct, text: steps[0].text });
    step = 1;

    const interval = setInterval(() => {
      if (step < steps.length) {
        setProgress({ pct: steps[step].pct, text: steps[step].text });
        step++;
      } else {
        setProgress(prev =>
          prev && prev.pct < 95
            ? { pct: Math.min(prev.pct + 1, 95), text: 'Finalizando consulta...' }
            : prev
        );
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [isLoading, isLoadingDetails]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async () => {
    if (!selectedRut) return;
    setIsLoading(true);
    setError(null);
    setExamList([]);
    setExamDetails([]);
    setSelectedLinks(new Set());
    setPdfExam(null);

    try {
      const data = await searchSyslabExams(selectedRut);
      if (data.success) {
        setExamList(data.data);
      } else {
        setError(data.error || 'No se pudieron obtener los resultados.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al buscar exámenes. Verifica que el servidor Syslab esté activo.'
      );
    } finally {
      setIsLoading(false);
    }
  }, [selectedRut]);

  const handleToggleLink = useCallback((link: string) => {
    setSelectedLinks(prev => {
      const next = new Set(prev);
      if (next.has(link)) next.delete(link);
      else next.add(link);
      return next;
    });
  }, []);

  const handleToggleAll = useCallback(() => {
    const selectableLinks = examList.filter(e => e.link).map(e => e.link!);
    setSelectedLinks(prev => {
      const allSelected = selectableLinks.every(l => prev.has(l));
      return allSelected ? new Set() : new Set(selectableLinks);
    });
  }, [examList]);

  const handleFetchDetails = useCallback(async () => {
    const links = Array.from(selectedLinks);
    if (links.length === 0) return;

    setIsLoadingDetails(true);
    setExamDetails([]);
    setError(null);

    try {
      const data = await fetchSyslabExamDetails(links);
      if (data.success) {
        setExamDetails(data.data);
      } else {
        setError(data.error || 'No se pudieron obtener los detalles.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al obtener detalles. Verifica que el servidor Syslab esté activo.'
      );
    } finally {
      setIsLoadingDetails(false);
    }
  }, [selectedLinks]);

  React.useEffect(() => {
    if (isOpen && initialPatientRut) {
      setSelectedRut(initialPatientRut);
      setExamList([]);
      setExamDetails([]);
      setSelectedLinks(new Set());
      setError(null);
    }
  }, [isOpen, initialPatientRut]);

  if (!isOpen) return null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      variant="white"
      size={pdfExam ? '5xl' : '3xl'}
      className="!rounded-2xl ring-1 ring-black/[0.03]"
      bodyClassName="max-h-[90vh] overflow-y-auto px-5 py-4"
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-500/20">
            <FlaskConical size={16} />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-slate-800">
            Laboratorio / Exámenes Syslab
          </span>
        </span>
      }
    >
      <LabViewerControls
        uniquePatients={uniquePatients}
        selectedRut={selectedRut}
        isLoading={isLoading || isLoadingDetails}
        onPatientChange={rut => {
          setSelectedRut(rut);
          setExamList([]);
          setExamDetails([]);
          setSelectedLinks(new Set());
          setPdfExam(null);
          setError(null);
        }}
        onSearch={handleSearch}
      />

      <LabViewerProgress progress={progress} />

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {error}
        </div>
      )}

      {/* PDF Viewer */}
      {pdfExam && <LabViewerPdf exam={pdfExam} onBack={() => setPdfExam(null)} />}

      {/* Phase 1: Exam list */}
      {!pdfExam && examList.length > 0 && examDetails.length === 0 && !isLoading && (
        <LabViewerExamList
          exams={examList}
          selectedLinks={selectedLinks}
          onToggle={handleToggleLink}
          onToggleAll={handleToggleAll}
          onFetchDetails={handleFetchDetails}
          onViewPdf={exam => setPdfExam(exam)}
          isLoadingDetails={isLoadingDetails}
        />
      )}

      {/* Phase 2: Detailed results */}
      {!pdfExam && examDetails.length > 0 && !isLoadingDetails && (
        <>
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setExamDetails([])}
              className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
            >
              &larr; Volver a lista de exámenes
            </button>
          </div>
          <LabViewerResults details={examDetails} exams={examList} />
        </>
      )}

      {/* Empty state */}
      {!pdfExam &&
        examList.length === 0 &&
        examDetails.length === 0 &&
        !isLoading &&
        !isLoadingDetails &&
        !error && <LabViewerEmptyState />}
    </BaseModal>
  );
};
