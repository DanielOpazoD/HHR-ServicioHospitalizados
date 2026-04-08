/**
 * @module LabResultsViewerModal
 * @description Modal for viewing laboratory exams from the Syslab system.
 */

import React, { useEffect } from 'react';
import { FlaskConical } from 'lucide-react';
import { BaseModal } from '@/components/shared/BaseModal';
import { useLabViewer } from '../hooks/useLabViewer';
import type { LabPatient } from '@/types/domain/laboratory';
import { LabViewerControls } from './LabViewerControls';
import { LabViewerProgress } from './LabViewerProgress';
import { LabViewerExamList } from './LabViewerExamList';
import { LabViewerAnalyzeBar } from './LabViewerAnalyzeBar';
import { LabViewerPdf } from './LabViewerPdf';
import { LabViewerAnalysis } from './LabViewerAnalysis';
import { LabViewerEmptyState } from './LabViewerEmptyState';

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
  const lab = useLabViewer(patients, initialPatientRut);

  useEffect(() => {
    if (isOpen) lab.reset();
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const isViewingPdf = lab.pdfExam !== null;
  const isViewingAnalysis = lab.analysisData !== null;
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
      {!isViewingAnalysis && (
        <LabViewerControls
          uniquePatients={lab.uniquePatients}
          selectedRut={lab.selectedRut}
          isLoading={lab.isLoading || lab.isAnalyzing}
          onPatientChange={lab.selectPatient}
          onSearch={lab.search}
        />
      )}

      <LabViewerProgress progress={lab.progress} />

      {lab.error && (
        <div className="mb-4 rounded-xl border border-red-200/80 bg-red-50 px-4 py-3 text-[13px] text-red-700">
          {lab.error}
        </div>
      )}

      {isViewingAnalysis && !lab.isAnalyzing && (
        <LabViewerAnalysis
          data={lab.analysisData!}
          activeTab={lab.analysisView}
          onTabChange={lab.setAnalysisView}
          onBack={lab.closeAnalysis}
        />
      )}

      {isViewingPdf && !isViewingAnalysis && (
        <LabViewerPdf exam={lab.pdfExam!} onBack={lab.closePdf} />
      )}

      {!isViewingPdf && !isViewingAnalysis && lab.examList.length > 0 && !lab.isLoading && (
        <>
          <LabViewerExamList
            exams={lab.filteredExamList}
            selectedIds={lab.selectedExamIds}
            filterCategories={lab.examFilterCategories}
            activeFilter={lab.activeExamFilter}
            onFilterChange={lab.setExamFilter}
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

      {!isViewingPdf &&
        !isViewingAnalysis &&
        lab.examList.length === 0 &&
        !lab.isLoading &&
        !lab.isAnalyzing &&
        !lab.error && <LabViewerEmptyState />}
    </BaseModal>
  );
};
