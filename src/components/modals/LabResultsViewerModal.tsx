/**
 * @module LabResultsViewerModal
 * @description Modal for viewing laboratory exams from the Syslab system.
 *
 * Views:
 * 1. **Empty state** — before any search
 * 2. **Exam list** — with checkboxes for selection + "Ver PDF" buttons
 * 3. **PDF viewer** — inline iframe showing the original lab report PDF
 * 4. **Analysis** — summary table, trend charts, and comparison table
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
  LabViewerAnalyzeBar,
  LabViewerPdf,
  LabViewerAnalysis,
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

  // Always reset when modal opens — start fresh every time
  useEffect(() => {
    if (isOpen) {
      lab.reset();
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const isViewingPdf = lab.pdfExam !== null;
  const isViewingAnalysis = lab.analysisData !== null;

  // Dynamic modal size
  const modalSize = isViewingAnalysis ? 'full' : isViewingPdf ? '5xl' : '3xl';

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      variant="white"
      size={modalSize}
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
      {/* Controls — hidden during analysis */}
      {!isViewingAnalysis && (
        <LabViewerControls
          uniquePatients={lab.uniquePatients}
          selectedRut={lab.selectedRut}
          isLoading={lab.isLoading || lab.isAnalyzing}
          onPatientChange={lab.selectPatient}
          onSearch={lab.search}
        />
      )}

      {/* Progress bar */}
      <LabViewerProgress progress={lab.progress} />

      {/* Error */}
      {lab.error && (
        <div className="mb-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {lab.error}
        </div>
      )}

      {/* Analysis view */}
      {isViewingAnalysis && !lab.isAnalyzing && (
        <LabViewerAnalysis
          data={lab.analysisData!}
          activeTab={lab.analysisView}
          onTabChange={lab.setAnalysisView}
          onBack={lab.closeAnalysis}
        />
      )}

      {/* PDF viewer */}
      {isViewingPdf && !isViewingAnalysis && (
        <LabViewerPdf exam={lab.pdfExam!} onBack={lab.closePdf} />
      )}

      {/* Exam list */}
      {!isViewingPdf && !isViewingAnalysis && lab.examList.length > 0 && !lab.isLoading && (
        <>
          <LabViewerExamList
            exams={lab.examList}
            selectedIds={lab.selectedExamIds}
            onToggleSelect={lab.toggleExamSelection}
            onSelectAll={lab.selectAllExams}
            onSelectByDays={lab.selectByDays}
            onViewPdf={lab.openPdf}
          />
          <LabViewerAnalyzeBar
            selectedCount={lab.selectedExamIds.size}
            isAnalyzing={lab.isAnalyzing}
            onAnalyze={lab.analyzeSelected}
            onClear={lab.clearSelection}
          />
        </>
      )}

      {/* Empty state */}
      {!isViewingPdf &&
        !isViewingAnalysis &&
        lab.examList.length === 0 &&
        !lab.isLoading &&
        !lab.isAnalyzing &&
        !lab.error && <LabViewerEmptyState />}
    </BaseModal>
  );
};
