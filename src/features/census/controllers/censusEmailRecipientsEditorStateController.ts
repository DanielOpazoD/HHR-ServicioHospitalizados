export interface CensusEmailRecipientsEditorTransientState {
  error: string | null;
  newRecipient: string;
  showBulkEditor: boolean;
  bulkRecipients: string;
  editingIndex: number | null;
  editingValue: string;
  showAllRecipients: boolean;
}

export const buildCensusEmailRecipientsEditorResetState = (
  safeRecipients: string[]
): CensusEmailRecipientsEditorTransientState => ({
  error: null,
  newRecipient: '',
  showBulkEditor: false,
  bulkRecipients: safeRecipients.join('\n'),
  editingIndex: null,
  editingValue: '',
  showAllRecipients: false,
});

export interface CensusEmailRecipientsBulkEditorState {
  showBulkEditor: boolean;
  bulkRecipients: string;
  error: string | null;
}

export const buildCensusEmailRecipientsBulkEditorState = (
  safeRecipients: string[],
  nextOpen: boolean
): CensusEmailRecipientsBulkEditorState => ({
  showBulkEditor: nextOpen,
  bulkRecipients: safeRecipients.join('\n'),
  error: null,
});
