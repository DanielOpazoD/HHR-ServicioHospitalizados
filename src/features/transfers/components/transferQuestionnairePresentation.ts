import { questionGroups } from '@/constants/hospitalConfigs';
import type { HospitalConfig, TransferQuestion } from '@/types/transferDocuments';

export const buildTransferQuestionnaireGroups = (
  hospital: HospitalConfig
): Record<string, TransferQuestion[]> => {
  const groups: Record<string, TransferQuestion[]> = {};

  hospital.templates.forEach(template => {
    if (template.enabled) {
      groups[template.id] = [];
    }
  });

  hospital.questions.forEach(question => {
    const group = question.group || 'general';
    if (!groups[group]) groups[group] = [];
    groups[group].push(question);
  });

  return Object.fromEntries(
    Object.entries(groups).filter(
      ([key, questions]) => questions.length > 0 && key !== 'solicitud-ambulancia'
    )
  );
};

export const resolveTransferQuestionnaireGroupLabel = (group: string): string =>
  questionGroups[group as keyof typeof questionGroups]?.label || group;
