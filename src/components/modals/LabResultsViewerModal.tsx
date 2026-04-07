/**
 * @module LabResultsViewerModal
 * @description Modal for viewing laboratory exams from the Syslab system.
 *
 * Renders a {@link BaseModal} with three possible views:
 * 1. **Empty state** — before any search (patient selector visible)
 * 2. **Exam list** — after searching, shows exam cards with "Ver PDF" buttons
 * 3. **PDF viewer** — inline iframe showing the original lab report PDF
 *
 * All state management is delegated to the {@link useLabViewer} hook.
 */

import React, { useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { BaseModal } from '@/components/shared/BaseModal';
import { useLabViewer } from '@/hooks/laboratory/useLabViewer';
import type { LabPatient } from '@/types/domain/laboratory';
import {
  LabViewerControls,
  LabViewerProgress,
  LabViewerExamList,
  LabViewerPdf,
  LabViewerEmptyState,
} from '@/components/modals/LabResultsViewerModalContent';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface LabResultsViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: LabPatient[];
  initialPatientRut?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const LabResultsViewerModal: React.FC<LabResultsViewerModalProps> = ({
  isOpen,
  onClose,
  patients,
  initialPatientRut,
}) => {
  const lab = useLabViewer(patients, initialPatientRut);

  // Reset state when modal reopens with a different patient
  useEffect(() => {
    if (isOpen && initialPatientRut) {
      lab.reset();
    }
  }, [isOpen, initialPatientRut]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const isViewingPdf = lab.pdfExam !== null;

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      variant="white"
      size={isViewingPdf ? '5xl' : '3xl'}
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
      {/* Controls — always visible */}
      <LabViewerControls
        uniquePatients={lab.uniquePatients}
        selectedRut={lab.selectedRut}
        isLoading={lab.isLoading}
        onPatientChange={lab.selectPatient}
        onSearch={lab.search}
      />

      {/* Progress bar */}
      <LabViewerProgress progress={lab.progress} />

      {/* Error */}
      {lab.error && (
        <div className="mb-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {lab.error}
        </div>
      )}

      {/* PDF viewer */}
      {isViewingPdf && <LabViewerPdf exam={lab.pdfExam!} onBack={lab.closePdf} />}

      {/* Exam list */}
      {!isViewingPdf && lab.examList.length > 0 && !lab.isLoading && (
        <LabViewerExamList exams={lab.examList} onViewPdf={lab.openPdf} />
      )}

      {/* Empty state */}
      {!isViewingPdf && lab.examList.length === 0 && !lab.isLoading && !lab.error && (
        <LabViewerEmptyState />
      )}
    </BaseModal>
  );
};
