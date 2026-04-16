export const normalizeClinicalDocumentSectionTitle = (title: string, fallback: string): string => {
  const normalizedTitle = title.trim();
  const normalizedFallback = fallback.trim();

  if (normalizedTitle.length > 0) {
    return normalizedTitle;
  }

  return normalizedFallback.length > 0 ? normalizedFallback : 'Sección sin título';
};
