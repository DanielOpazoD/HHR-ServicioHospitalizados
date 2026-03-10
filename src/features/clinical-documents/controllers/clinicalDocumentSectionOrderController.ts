import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';

export const reorderClinicalDocumentVisibleSections = (
  sections: ClinicalDocumentRecord['sections'],
  sourceSectionId: string,
  targetSectionId: string
): ClinicalDocumentRecord['sections'] => {
  if (sourceSectionId === targetSectionId) {
    return sections;
  }

  const orderedSections = [...sections].sort((left, right) => left.order - right.order);
  const visibleSections = orderedSections.filter(section => section.visible !== false);
  const hiddenSections = orderedSections.filter(section => section.visible === false);
  const sourceIndex = visibleSections.findIndex(section => section.id === sourceSectionId);
  const targetIndex = visibleSections.findIndex(section => section.id === targetSectionId);

  if (sourceIndex === -1 || targetIndex === -1) {
    return sections;
  }

  const reorderedVisibleSections = [...visibleSections];
  const [movedSection] = reorderedVisibleSections.splice(sourceIndex, 1);
  reorderedVisibleSections.splice(targetIndex, 0, movedSection);

  const nextVisibleSections = reorderedVisibleSections.map((section, index) => ({
    ...section,
    order: index,
  }));
  const nextHiddenSections = hiddenSections.map((section, index) => ({
    ...section,
    order: nextVisibleSections.length + index,
  }));
  const nextSectionMap = new Map(
    [...nextVisibleSections, ...nextHiddenSections].map(section => [section.id, section])
  );

  return sections
    .map(section => nextSectionMap.get(section.id) || section)
    .sort((left, right) => left.order - right.order);
};

export const moveClinicalDocumentVisibleSection = (
  sections: ClinicalDocumentRecord['sections'],
  sectionId: string,
  direction: 'up' | 'down'
): ClinicalDocumentRecord['sections'] => {
  const visibleOrdered = [...sections]
    .filter(section => section.visible !== false)
    .sort((left, right) => left.order - right.order);
  const currentVisibleIndex = visibleOrdered.findIndex(section => section.id === sectionId);
  if (currentVisibleIndex === -1) {
    return sections;
  }

  const targetVisibleIndex = direction === 'up' ? currentVisibleIndex - 1 : currentVisibleIndex + 1;
  if (targetVisibleIndex < 0 || targetVisibleIndex >= visibleOrdered.length) {
    return sections;
  }

  const targetSection = visibleOrdered[targetVisibleIndex];
  if (!targetSection) {
    return sections;
  }

  return reorderClinicalDocumentVisibleSections(sections, sectionId, targetSection.id);
};
