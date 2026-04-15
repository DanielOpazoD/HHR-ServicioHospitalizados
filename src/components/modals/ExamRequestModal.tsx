/**
 * ExamRequestModal Component
 *
 * Modularized laboratory exam request form with print functionality.
 * Uses extracted components and hooks for better maintainability.
 * Premium aesthetic matching MedicalIndicationsDialog style.
 *
 * @see /docs/LABORATORY_FORM_GUIDE.md for design specifications
 */

import React from 'react';
import { Printer, FlaskConical, UserRound } from 'lucide-react';
import { BaseModal } from '@/components/shared/BaseModal';
import { getExamCategoryById } from '@/constants/examCategories';
import { useExamRequest } from '@/hooks/useExamRequest';
import type { PatientData } from '@/types/domain/patient';
import { EXAM_REQUEST_PRINT_STYLES } from '@/components/modals/examRequestPrintStyles';
import {
  ExamCheckbox,
  ExamFormHeader,
  ExamPatientInfo,
  ExamMetadata,
} from '@/components/exam-request';

interface ExamRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientData;
}

export const ExamRequestModal: React.FC<ExamRequestModalProps> = ({ isOpen, onClose, patient }) => {
  const bioquimica = getExamCategoryById('bioquimica');
  const hematologia = getExamCategoryById('hematologia');
  const coagulacion = getExamCategoryById('coagulacion');
  const hormonas = getExamCategoryById('hormonas');
  const microbiologicos = getExamCategoryById('microbiologicos');
  const orina = getExamCategoryById('orina');
  const parasitologia = getExamCategoryById('parasitologia');
  const virologia = getExamCategoryById('virologia');
  const inmunologia = getExamCategoryById('inmunologia');
  const otros = getExamCategoryById('otros');

  const {
    selectedExams,
    procedencia,
    prevision,
    setProcedencia,
    setPrevision,
    toggleExam,
    handlePrint,
  } = useExamRequest({ patient, isOpen });

  const renderExamItem = (exam: string, categoryTitle: string) => (
    <ExamCheckbox
      key={`${categoryTitle}|${exam}`}
      exam={exam}
      categoryTitle={categoryTitle}
      isSelected={selectedExams.has(`${categoryTitle}|${exam}`)}
      onToggle={toggleExam}
    />
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      printable={true}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md shadow-emerald-500/20">
            <FlaskConical size={16} />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold tracking-tight text-slate-800">
              Solicitud de Laboratorio
            </span>
            <span className="text-[11px] font-medium text-slate-400">{patient.patientName}</span>
          </span>
        </span>
      }
      size="full"
      variant="white"
      className="!rounded-2xl ring-1 ring-black/[0.03]"
      bodyClassName="max-h-[90vh] overflow-y-auto px-5 py-4"
      headerActions={
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:from-emerald-600 hover:to-emerald-700 hover:shadow-lg hover:shadow-emerald-600/30 active:scale-[0.98] print:hidden"
        >
          <Printer size={14} />
          Imprimir
        </button>
      }
    >
      {/* Patient info banner */}
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-emerald-50/40 to-transparent px-4 py-3 print:hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <UserRound size={16} />
        </div>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          <span className="font-semibold text-slate-700">{patient.patientName}</span>
          {patient.rut && (
            <>
              <span className="text-slate-400">|</span>
              <span className="text-slate-500">{patient.rut}</span>
            </>
          )}
          {patient.pathology && (
            <>
              <span className="text-slate-400">|</span>
              <span className="max-w-[260px] truncate text-slate-500" title={patient.pathology}>
                {patient.pathology}
              </span>
            </>
          )}
          {patient.bedName && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-100/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
              {patient.bedName}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {/* PDF Replica Container */}
        <div
          id="exam-request-form"
          className="bg-white p-2 border border-slate-300 shadow-sm mx-auto max-w-[800px] font-sans text-slate-900 print:p-0 print:border-none print:shadow-none print:m-0 print:max-w-none"
        >
          <ExamFormHeader />
          <ExamMetadata
            procedencia={procedencia}
            prevision={prevision}
            onProcedenciaChange={setProcedencia}
            onPrevisionChange={setPrevision}
          />
          <ExamPatientInfo patient={patient} />

          {/* Exams Grid */}
          <div className="grid grid-cols-12 border-2 border-slate-900 rounded-lg overflow-hidden min-h-[480px]">
            {/* Column 1: Bioquimica */}
            <div className="col-span-4 border-r-2 border-slate-900 flex flex-col">
              <div className="bg-white border-b-2 border-slate-900 text-slate-900 py-0.5 text-center flex flex-col items-center">
                <span className="text-[9px] font-black tracking-widest uppercase">
                  {bioquimica.name}
                </span>
                <span className="text-[6px] text-slate-500 font-bold">({bioquimica.tube})</span>
              </div>
              <div className="p-2 flex flex-col gap-0.5 flex-1">
                {bioquimica.exams.map(exam => renderExamItem(exam, bioquimica.name))}
              </div>
              <div className="bg-white border-t border-slate-300 p-2">
                <span className="text-[8px] font-black text-slate-400 uppercase block mb-1 underline">
                  TUBO VERDE
                </span>
                {renderExamItem('ELECTROLITOS PLASMATICOS', 'TUBO VERDE')}
                {renderExamItem('LACTATO', 'TUBO VERDE')}
              </div>
            </div>

            {/* Column 2: Hematologia, Coagulacion, Microbiologicos */}
            <div className="col-span-4 border-r-2 border-slate-900 flex flex-col">
              <div className="bg-white border-b-2 border-slate-900 text-slate-900 py-0.5 text-center flex flex-col items-center">
                <span className="text-[9px] font-black tracking-widest uppercase">
                  {hematologia.name}
                </span>
                <span className="text-[6px] text-slate-500 font-bold">({hematologia.tube})</span>
              </div>
              <div className="p-1 flex flex-col gap-0.5">
                <div className="grid grid-cols-2 gap-x-2">
                  {hematologia.exams.map(exam => renderExamItem(exam, hematologia.name))}
                </div>
              </div>

              <div className="bg-white border-b-2 border-t-2 border-slate-900 text-slate-900 py-0.5 text-center flex flex-col items-center">
                <span className="text-[9px] font-black tracking-widest uppercase">
                  {coagulacion.name}
                </span>
                <span className="text-[6px] text-slate-500 font-bold">({coagulacion.tube})</span>
              </div>
              <div className="p-2 flex flex-col gap-0.5">
                {coagulacion.exams.map(exam => renderExamItem(exam, coagulacion.name))}
              </div>

              <div className="bg-white border-t-2 border-b-2 border-slate-900 text-slate-900 p-1 text-center">
                <span className="text-[10px] font-black tracking-widest uppercase">
                  {microbiologicos.name}
                </span>
              </div>
              <div className="p-2 flex flex-col gap-0.5 flex-1 bg-slate-50/50">
                {microbiologicos.exams.map(exam => renderExamItem(exam, microbiologicos.name))}
              </div>
            </div>

            {/* Column 3: Hormonas, Orina, Virologia */}
            <div className="col-span-4 flex flex-col">
              <div className="bg-white border-b-2 border-slate-900 text-slate-900 py-0.5 text-center flex flex-col items-center">
                <span className="text-[9px] font-black tracking-widest uppercase">
                  {hormonas.name}
                </span>
                <span className="text-[6px] text-slate-500 font-bold">({hormonas.tube})</span>
              </div>
              <div className="p-1 flex flex-col gap-0.5 border-b border-slate-200">
                {hormonas.exams.map(exam => renderExamItem(exam, hormonas.name))}
              </div>

              <div className="bg-white border-t-2 border-b-2 border-slate-900 text-slate-900 py-0.5 text-center">
                <span className="text-[9px] font-black tracking-widest uppercase">
                  Orina / Parásitos
                </span>
              </div>
              <div className="p-2 flex flex-col gap-0.5 border-b border-slate-200">
                {orina.exams.map(exam => renderExamItem(exam, orina.name))}
                <div className="h-px bg-slate-200 my-1"></div>
                {parasitologia.exams.map(exam => renderExamItem(exam, parasitologia.name))}
              </div>

              <div className="bg-white border-t-2 border-b-2 border-slate-900 text-slate-900 py-0.5 text-center">
                <span className="text-[9px] font-black tracking-widest uppercase">
                  Virología / Otros
                </span>
              </div>
              <div className="p-2 flex flex-col gap-0.5 flex-1">
                {virologia.exams.map(exam => renderExamItem(exam, virologia.name))}
                <div className="h-px bg-slate-200 my-1"></div>
                {otros.exams.map(exam => renderExamItem(exam, otros.name))}
              </div>
            </div>
          </div>

          {/* Footer Section */}
          <div className="grid grid-cols-12 border-2 border-slate-900 rounded-lg mt-0.5 overflow-hidden">
            <div className="col-span-4 border-r-2 border-slate-900 flex flex-col">
              <div className="bg-white border-b-2 border-slate-900 text-slate-900 py-0.5 text-center flex flex-col items-center">
                <span className="text-[9px] font-black tracking-widest uppercase">
                  {inmunologia.name}
                </span>
                <span className="text-[6px] text-slate-500 font-bold">({inmunologia.tube})</span>
              </div>
              <div className="p-1 flex flex-col gap-0.5">
                {inmunologia.exams.map(exam => renderExamItem(exam, inmunologia.name))}
              </div>
            </div>

            <div className="col-span-8 p-2 flex flex-col gap-4 justify-center">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-900 uppercase whitespace-nowrap">
                  OTROS:
                </span>
                <div className="flex-1 flex flex-col gap-3">
                  <div className="border-b border-slate-900 h-0.5 w-full"></div>
                  <div className="border-b border-slate-900 h-0.5 w-full"></div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-900 uppercase whitespace-nowrap">
                  MEDICO TRATANTE:
                </span>
                <div className="border-b border-slate-900 flex-1 h-0.5 mt-1"></div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-slate-900 uppercase whitespace-nowrap">
                  FIRMA:
                </span>
                <div className="border-b border-slate-900 flex-1 h-0.5 mt-1"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: EXAM_REQUEST_PRINT_STYLES }} />
    </BaseModal>
  );
};
