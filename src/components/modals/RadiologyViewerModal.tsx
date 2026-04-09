import React, { useState, useCallback, useMemo } from 'react';
import { Radio } from 'lucide-react';
import { BaseModal } from '@/components/shared/BaseModal';
import {
  searchMMRADExams,
  type MMRADExam,
  type MMRADSearchResult,
} from '@/services/radiology/mmradService';
import {
  RadiologyViewerControls,
  RadiologyViewerEmptyState,
  RadiologyViewerProgress,
  RadiologyViewerResults,
} from '@/components/modals/RadiologyViewerModalContent';
import { BEDS } from '@/constants/beds';

interface RadiologyPatient {
  bedId: string;
  label: string;
  patientName: string;
  rut: string;
  diagnosis?: string;
}

interface RadiologyViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: RadiologyPatient[];
  initialPatientRut?: string;
}

/** Extract unique modality codes from exams, sorted with CT first. */
const extractModalities = (exams: MMRADExam[]): string[] => {
  const mods = new Set<string>();
  for (const exam of exams) {
    const mod = (exam.mod || '').trim().toUpperCase();
    if (mod) mods.add(mod);
  }
  const sorted = Array.from(mods).sort((a, b) => {
    if (a === 'CT') return -1;
    if (b === 'CT') return 1;
    return a.localeCompare(b);
  });
  return sorted;
};

export const RadiologyViewerModal: React.FC<RadiologyViewerModalProps> = ({
  isOpen,
  onClose,
  patients,
  initialPatientRut,
}) => {
  const [selectedRut, setSelectedRut] = useState(initialPatientRut || patients[0]?.rut || '');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<MMRADSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ pct: number; text: string } | null>(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeModTab, setActiveModTab] = useState<string | null>(null);

  // Deduplicate patients by RUT, sorted by hospital bed order (R1-R4, NEO, H1C1…H6C2)
  const uniquePatients = useMemo(() => {
    const bedOrder = new Map(BEDS.map((bed, idx) => [bed.id, idx]));
    const seen = new Set<string>();
    return patients
      .filter(p => {
        if (!p.rut || seen.has(p.rut)) return false;
        seen.add(p.rut);
        return true;
      })
      .sort((a, b) => (bedOrder.get(a.bedId) ?? 999) - (bedOrder.get(b.bedId) ?? 999));
  }, [patients]);

  // Modality tabs from results
  const modalities = useMemo(() => (result ? extractModalities(result.examenes) : []), [result]);

  // Filtered exams by active tab, sorted most-recent first
  const filteredExams = useMemo(() => {
    if (!result) return [];
    const exams = activeModTab
      ? result.examenes.filter(e => (e.mod || '').trim().toUpperCase() === activeModTab)
      : [...result.examenes];
    exams.sort((a, b) => {
      const toTimestamp = (raw: string): number => {
        if (!raw) return 0;
        // Try DD/MM/YYYY or DD-MM-YYYY (common RIS format)
        const parts = raw.split(/[/\-\.]/);
        if (parts.length === 3 && parts[0].length <= 2) {
          const [dd, mm, yyyy] = parts;
          return new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`).getTime() || 0;
        }
        // Fallback: try direct parse (handles ISO or other formats)
        return new Date(raw).getTime() || 0;
      };
      return toTimestamp(b.fecha_examen) - toTimestamp(a.fecha_examen);
    });
    return exams;
  }, [result, activeModTab]);

  // Reset tab when results change
  React.useEffect(() => {
    if (result && modalities.length > 0) {
      // Default to CT if available, otherwise first modality
      setActiveModTab(modalities.includes('CT') ? 'CT' : null);
    } else {
      setActiveModTab(null);
    }
  }, [result, modalities]);

  /**
   * Simulated progress bar.
   */
  React.useEffect(() => {
    if (!isLoading) {
      if (progress) {
        setProgress({ pct: 100, text: '¡Completado!' });
        const timeout = setTimeout(() => setProgress(null), 600);
        return () => clearTimeout(timeout);
      }
      return;
    }

    const steps = [
      { pct: 10, text: 'Conectando con el servidor de imágenes...' },
      { pct: 30, text: 'Iniciando sesión en RIS MMRAD...' },
      { pct: 50, text: 'Buscando exámenes del paciente...' },
      { pct: 70, text: 'Extrayendo informes y enlaces...' },
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
    }, 2000);

    return () => clearInterval(interval);
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async () => {
    if (!selectedRut) return;
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await searchMMRADExams({
        rut: selectedRut,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al buscar exámenes');
    } finally {
      setIsLoading(false);
    }
  }, [selectedRut, dateFrom, dateTo]);

  const setDatePreset = (preset: 'last-month' | 'last-year' | 'last-5-years') => {
    const today = new Date();
    const to = today.toISOString().split('T')[0];
    const from = new Date(today);
    if (preset === 'last-month') from.setMonth(from.getMonth() - 1);
    else if (preset === 'last-year') from.setFullYear(from.getFullYear() - 1);
    else from.setFullYear(from.getFullYear() - 5);
    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(to);
  };

  React.useEffect(() => {
    if (isOpen && initialPatientRut) {
      setSelectedRut(initialPatientRut);
      setResult(null);
      setError(null);
    }
  }, [isOpen, initialPatientRut]);

  if (!isOpen) return null;

  return (
    <>
      <BaseModal
        isOpen={isOpen}
        onClose={onClose}
        variant="white"
        size="3xl"
        className="!rounded-2xl ring-1 ring-black/[0.03]"
        bodyClassName="max-h-[85vh] overflow-y-auto px-5 py-4"
        title={
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md shadow-violet-500/20">
              <Radio size={16} />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-slate-800">
              Radiología / Imagenología
            </span>
          </span>
        }
      >
        <RadiologyViewerControls
          uniquePatients={uniquePatients}
          selectedRut={selectedRut}
          isLoading={isLoading}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onPatientChange={rut => {
            setSelectedRut(rut);
            setResult(null);
            setError(null);
          }}
          onSearch={handleSearch}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          onSetDatePreset={setDatePreset}
          onClearDates={() => {
            setDateFrom('');
            setDateTo('');
          }}
        />

        <RadiologyViewerProgress progress={progress} />

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        <RadiologyViewerResults
          result={result}
          isLoading={isLoading}
          modalities={modalities}
          activeModTab={activeModTab}
          filteredExams={filteredExams}
          onTabChange={setActiveModTab}
        />

        {!result && !isLoading && !error && <RadiologyViewerEmptyState />}
      </BaseModal>
    </>
  );
};
