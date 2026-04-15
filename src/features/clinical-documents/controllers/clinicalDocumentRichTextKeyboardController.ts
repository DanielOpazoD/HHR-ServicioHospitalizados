import type { KeyboardEvent } from 'react';

export type ClinicalDocumentRichTextKeyboardCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'insertOrderedList'
  | 'undo'
  | 'redo'
  | 'indent'
  | 'outdent';

/**
 * Resolves the editor command triggered by a keyboard shortcut.
 * Keeps shortcut mapping outside the hook so the runtime stays focused
 * on selection, history, and DOM synchronization.
 */
export const resolveClinicalDocumentKeyboardShortcut = (
  event: Pick<KeyboardEvent<HTMLDivElement>, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey'>
): ClinicalDocumentRichTextKeyboardCommand | null => {
  const isPrimaryModifier = event.metaKey || event.ctrlKey;
  const lowerKey = event.key.toLowerCase();

  if (isPrimaryModifier && lowerKey === 'b') return 'bold';
  if (isPrimaryModifier && lowerKey === 'i') return 'italic';
  if (isPrimaryModifier && lowerKey === 'u') return 'underline';
  if (isPrimaryModifier && event.shiftKey && lowerKey === '7') return 'insertOrderedList';
  if (isPrimaryModifier && event.shiftKey && lowerKey === 'z') return 'redo';
  if (isPrimaryModifier && lowerKey === 'z') return 'undo';
  if (event.key === 'Tab') return event.shiftKey ? 'outdent' : 'indent';

  return null;
};
