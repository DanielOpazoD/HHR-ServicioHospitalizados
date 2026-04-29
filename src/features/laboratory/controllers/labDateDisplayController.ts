export const formatLabExamColumnLabel = (examDate: string, includeTimeInColumns = true): string => {
  if (includeTimeInColumns) {
    return examDate;
  }

  const dateOnlyMatch = examDate.match(/^(\d{2}\/\d{2}\/\d{4})(?:\s+\d{2}:\d{2})?$/);
  return dateOnlyMatch?.[1] ?? examDate;
};
