/**
 * Clinical Document Update Controller
 *
 * Pure logic for creating clinical update sections.
 * Each update is a section with kind: 'clinical-update',
 * auto-populated date/time, and a unique incremental ID.
 */

import type { ClinicalDocumentSection } from '@/features/clinical-documents/domain/entities';

/**
 * Creates a new clinical update section with the current date and time.
 *
 * @param existingSections - Current sections to calculate next order
 * @returns A new section configured as a clinical update
 */
export const createClinicalUpdateSection = (
  existingSections: ClinicalDocumentSection[]
): ClinicalDocumentSection => {
  const now = new Date();
  const maxOrder = existingSections.reduce((max, s) => Math.max(max, s.order), 0);
  const updateCount = existingSections.filter(s => s.kind === 'clinical-update').length;

  return {
    id: `clinical-update-${updateCount + 1}-${Date.now()}`,
    title: 'Actualización clínica',
    content: '',
    kind: 'clinical-update',
    order: maxOrder + 1,
    required: false,
    visible: true,
    updateDate: formatDateISO(now),
    updateTime: formatTime(now),
  };
};

/** Formats a Date to YYYY-MM-DD. */
const formatDateISO = (date: Date): string => date.toISOString().slice(0, 10);

/** Formats a Date to HH:MM. */
const formatTime = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
