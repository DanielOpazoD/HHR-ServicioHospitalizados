import type { LabPatient } from '@/types/domain/labExamTypes';
import type { LabAnalysisData } from '@/types/domain/labAnalyticsTypes';
import { formatLabResult } from './labFormattingController';

const formatBirthDateForClipboard = (birthDate?: string): string => {
  if (!birthDate) return 'No registrada';
  const isoMatch = birthDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${day}-${month}-${year}`;
  }
  return birthDate;
};

export const buildLabComparisonClipboardText = (
  data: LabAnalysisData,
  patient: LabPatient | null,
  variableNames: string[]
): string => {
  const lines: string[] = [
    'Resumen de laboratorio',
    `Paciente: ${patient?.patientName || 'No registrado'}`,
    `RUT: ${patient?.rut || 'No registrado'}`,
    `Fecha de nacimiento: ${formatBirthDateForClipboard(patient?.birthDate)}`,
    '',
    ['Variable', ...data.examDates].join(' | '),
  ];

  for (const variableName of variableNames) {
    const row = [variableName];
    for (const date of data.examDates) {
      const finding = data.comparison[variableName]?.[date];
      if (!finding) {
        row.push('--');
        continue;
      }
      if (finding.qualitative) {
        row.push(finding.result);
        continue;
      }
      row.push(formatLabResult(finding.result, finding.unit).display);
    }
    lines.push(row.join(' | '));
  }

  return lines.join('\n');
};
