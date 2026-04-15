import { useCallback, useMemo, useRef, useState } from 'react';
import { usePortalPopoverRuntime } from '@/hooks/usePortalPopoverRuntime';
import { resolveUpcClassification } from '@/domain/upc/upcClassification';
import type { UpcClassification } from '@/domain/upc/upcClassification';
import type { UpcChecklistRecord } from '@/features/census/contracts/censusUpcContracts';
import {
  sanitizeCriterionIds,
  isValidUciCriterionId,
  isValidUtiCriterionId,
} from '@/domain/upc/upcCriteria';

const PANEL_WIDTH = 380;
const MIN_POPOVER_HEIGHT = 400;
const VIEWPORT_PADDING = 8;

export interface UpcChecklistActor {
  readonly uid: string;
  readonly displayName: string;
}

interface UseUpcChecklistControllerParams {
  checklist: UpcChecklistRecord | undefined;
  onSave: (record: UpcChecklistRecord) => void;
  disabled: boolean;
  /** Whether UCI criteria are allowed for this bed (false for Neo1/Neo2). */
  uciAllowed: boolean;
  /** Authenticated user for audit trail. */
  actor: UpcChecklistActor | null;
}

export const useUpcChecklistController = ({
  checklist,
  onSave,
  disabled,
  uciAllowed,
  actor,
}: UseUpcChecklistControllerParams) => {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Draft state — local until save
  const [draftUci, setDraftUci] = useState<Set<string>>(new Set());
  const [draftUti, setDraftUti] = useState<Set<string>>(new Set());

  // Sanitize persisted IDs before hydrating draft state
  const resetFromPersisted = useCallback(() => {
    const safeUci = uciAllowed
      ? sanitizeCriterionIds(checklist?.uciCriteria, isValidUciCriterionId)
      : [];
    const safeUti = sanitizeCriterionIds(checklist?.utiCriteria, isValidUtiCriterionId);
    setDraftUci(new Set(safeUci));
    setDraftUti(new Set(safeUti));
  }, [checklist, uciAllowed]);

  const closePopover = useCallback(() => setIsOpen(false), []);

  const resolvePopoverPosition = useCallback(() => {
    if (!buttonRef.current) return null;
    const rect = buttonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow > MIN_POPOVER_HEIGHT
        ? rect.bottom + 4
        : Math.max(VIEWPORT_PADDING, rect.top - MIN_POPOVER_HEIGHT);
    const left = Math.max(
      VIEWPORT_PADDING,
      Math.min(rect.left, window.innerWidth - PANEL_WIDTH - VIEWPORT_PADDING)
    );
    return { top, left };
  }, []);

  const { position: popoverPos, updatePosition } = usePortalPopoverRuntime({
    isOpen,
    anchorRef: buttonRef,
    popoverRef,
    initialPosition: { top: 0, left: 0 },
    resolvePosition: resolvePopoverPosition,
    onClose: closePopover,
    closeOnScroll: true,
    closeOnOutsideClick: true,
    closeOnEscape: true,
  });

  const togglePopover = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (disabled) return;
      if (!isOpen) {
        resetFromPersisted();
        updatePosition();
      }
      setIsOpen(prev => !prev);
    },
    [disabled, isOpen, resetFromPersisted, updatePosition]
  );

  const toggleUciCriterion = useCallback((id: string) => {
    setDraftUci(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleUtiCriterion = useCallback((id: string) => {
    setDraftUti(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const draftClassification: UpcClassification = useMemo(
    () => resolveUpcClassification({ uciCriteria: draftUci, utiCriteria: draftUti }),
    [draftUci, draftUti]
  );

  const hasDraftCriteria = useMemo(
    () => draftUci.size > 0 || draftUti.size > 0,
    [draftUci, draftUti]
  );

  const saveAndClose = useCallback(() => {
    onSave({
      uciCriteria: Array.from(draftUci),
      utiCriteria: Array.from(draftUti),
      classification: draftClassification,
      evaluatedAt: new Date().toISOString(),
      ...(actor ? { evaluatedBy: { uid: actor.uid, displayName: actor.displayName } } : {}),
    } as UpcChecklistRecord);
    setIsOpen(false);
  }, [actor, draftClassification, draftUci, draftUti, onSave]);

  const clearAndClose = useCallback(() => {
    onSave({
      uciCriteria: [],
      utiCriteria: [],
      classification: null,
      evaluatedAt: new Date().toISOString(),
      ...(actor ? { evaluatedBy: { uid: actor.uid, displayName: actor.displayName } } : {}),
    } as UpcChecklistRecord);
    setDraftUci(new Set());
    setDraftUti(new Set());
    setIsOpen(false);
  }, [actor, onSave]);

  return {
    isOpen,
    buttonRef,
    popoverRef,
    popoverPos,
    togglePopover,
    draftUci,
    draftUti,
    draftClassification,
    hasDraftCriteria,
    uciAllowed,
    toggleUciCriterion,
    toggleUtiCriterion,
    saveAndClose,
    clearAndClose,
    closePopover,
  };
};
