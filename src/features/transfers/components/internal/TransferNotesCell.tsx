import React, { useMemo, useState } from 'react';
import { Pencil, Plus, Save, Trash2, X } from 'lucide-react';
import type { TransferFormData, TransferNote } from '@/types/transfers';
import { formatTransferDateTime } from '@/shared/transfers/transferPresentation';
import { buildTransferNote } from '@/hooks/controllers/transferManagementController';
import {
  canManageTransferNotes,
  getSortedTransferNotes,
} from '../controllers/transferNotesController';
import type { TransferTableMode } from '../controllers/transferTableController';
import type { UserRole } from '@/types/auth';

interface TransferNotesCellProps {
  transferId: string;
  transferNotes?: TransferNote[];
  role?: UserRole;
  mode: TransferTableMode;
  currentUserEmail?: string | null;
  onUpdateTransfer: (transferId: string, data: Partial<TransferFormData>) => Promise<void>;
}

export const TransferNotesCell: React.FC<TransferNotesCellProps> = ({
  transferId,
  transferNotes,
  role,
  mode,
  currentUserEmail,
  onUpdateTransfer,
}) => {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  const sortedNotes = useMemo(() => getSortedTransferNotes(transferNotes), [transferNotes]);
  const canManageNotes = canManageTransferNotes(role, mode);

  const resetNoteEditor = () => {
    setIsComposerOpen(false);
    setNoteDraft('');
    setEditingNoteId(null);
    setEditingContent('');
  };

  const persistNotes = async (nextNotes: TransferNote[]) => {
    setIsSavingNote(true);
    try {
      await onUpdateTransfer(transferId, { transferNotes: nextNotes });
      resetNoteEditor();
    } finally {
      setIsSavingNote(false);
    }
  };

  const handleCreateNote = async () => {
    const content = noteDraft.trim();
    if (!content) return;

    await persistNotes([
      ...(transferNotes || []),
      buildTransferNote(content, currentUserEmail || 'usuario-desconocido'),
    ]);
  };

  const handleEditStart = (note: TransferNote) => {
    setEditingNoteId(note.id);
    setEditingContent(note.content);
    setIsComposerOpen(false);
  };

  const handleSaveEditedNote = async (noteId: string) => {
    const content = editingContent.trim();
    if (!content) return;

    await persistNotes(
      (transferNotes || []).map(note =>
        note.id === noteId
          ? {
              ...note,
              content,
            }
          : note
      )
    );
  };

  const handleDeleteNote = async (noteId: string) => {
    await persistNotes((transferNotes || []).filter(note => note.id !== noteId));
  };

  return (
    <div className="space-y-2">
      {sortedNotes.length > 0
        ? sortedNotes.map(note => {
            const isEditing = editingNoteId === note.id;

            return (
              <div key={note.id} className="rounded-lg border border-slate-100 bg-slate-50 p-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="normal-case tracking-normal text-[11px] font-medium text-slate-500">
                      {formatTransferDateTime(note.createdAt)} ({note.createdBy})
                    </div>
                  </div>
                  {canManageNotes && !isEditing && (
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleEditStart(note)}
                        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700"
                        title="Editar nota"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void handleDeleteNote(note.id);
                        }}
                        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-rose-100 hover:text-rose-700"
                        title="Eliminar nota"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={editingContent}
                      onChange={event => setEditingContent(event.target.value)}
                      rows={3}
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      aria-label={`Editar nota ${note.id}`}
                    />
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={resetNoteEditor}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-white"
                        title="Cancelar edición de nota"
                      >
                        <X size={12} />
                      </button>
                      <button
                        type="button"
                        disabled={isSavingNote || !editingContent.trim()}
                        onClick={() => {
                          void handleSaveEditedNote(note.id);
                        }}
                        className="inline-flex items-center justify-center rounded-md bg-blue-600 p-2 text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                        title="Guardar nota"
                        aria-label="Guardar nota"
                      >
                        <Save size={12} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-1 whitespace-normal break-words leading-snug text-slate-600">
                    {note.content}
                  </p>
                )}
              </div>
            );
          })
        : null}

      {canManageNotes && (
        <div className="rounded-lg border border-dashed border-slate-200 bg-white/70 p-2">
          {isComposerOpen ? (
            <div className="space-y-2">
              <textarea
                value={noteDraft}
                onChange={event => setNoteDraft(event.target.value)}
                rows={5}
                placeholder="Agregar nota de coordinación, observación clínica o seguimiento."
                className="w-full min-h-28 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                aria-label="Agregar nota"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={resetNoteEditor}
                  className="inline-flex items-center justify-center rounded-md border border-slate-200 p-2 text-slate-600 hover:bg-white"
                  title="Cancelar nota"
                >
                  <X size={14} />
                </button>
                <button
                  type="button"
                  disabled={isSavingNote || !noteDraft.trim()}
                  onClick={() => {
                    void handleCreateNote();
                  }}
                  className="inline-flex items-center justify-center rounded-md bg-blue-600 p-2 text-white disabled:cursor-not-allowed disabled:bg-blue-300"
                  title="Guardar nota"
                  aria-label="Guardar nota"
                >
                  <Save size={14} />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEditingNoteId(null);
                setEditingContent('');
                setIsComposerOpen(true);
              }}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              <Plus size={12} /> {sortedNotes.length > 0 ? 'Agregar nota' : 'Ingresar nota'}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
