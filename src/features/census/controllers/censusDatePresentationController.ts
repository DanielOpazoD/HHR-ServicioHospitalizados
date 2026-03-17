import { formatCensusIsoDate } from '@/shared/census/censusPresentation';

export const formatCensusHeaderDate = (isoDate: string, locale = 'es-CL'): string => {
  return formatCensusIsoDate(isoDate, locale);
};
