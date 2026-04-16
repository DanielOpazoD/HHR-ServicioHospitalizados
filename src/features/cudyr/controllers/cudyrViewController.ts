export interface CudyrViewShellModel {
  formattedPrintDate: string;
  responsibleNursesLabel: string;
  hasResponsibleNurses: boolean;
  categorizationIndex: number;
}

export const buildCudyrViewShellModel = ({
  recordDate,
  responsibleNurses,
  occupiedCount,
  categorizedCount,
}: {
  recordDate: string;
  responsibleNurses: string[];
  occupiedCount: number;
  categorizedCount: number;
}): CudyrViewShellModel => {
  const [year, month, day] = recordDate.split('-');

  return {
    formattedPrintDate: year && month && day ? `${day}-${month}-${year}` : recordDate,
    responsibleNursesLabel: responsibleNurses.join(', '),
    hasResponsibleNurses: responsibleNurses.length > 0,
    categorizationIndex:
      occupiedCount > 0 ? Math.round((categorizedCount / occupiedCount) * 100) : 0,
  };
};
