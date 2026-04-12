import React from 'react';
import { usePatientRowOrbitalLauncherMachine } from '@/features/census/components/patient-row/usePatientRowOrbitalLauncherMachine';
import {
  HOVER_EXIT_GRACE_MS,
  HOVER_FINE_MEDIA_QUERY,
  LAUNCHER_OPEN_EVENT,
  LAUNCHER_OWNER_EVENT,
  dispatchLauncherOpenChange,
  dispatchLauncherOwnerChange,
  isPointerInActivationZone,
  isPointerInExternalLeftActivationBand,
  resolveLauncherTriggerVisibility,
  resolveLauncherPosition,
  resolveRowElement,
  resolveRowId,
  resolveSupportsHoverFine,
  type LauncherActiveChangeDetail,
  type LauncherPosition,
  type UsePatientRowOrbitalLauncherRuntimeParams,
  type UsePatientRowOrbitalLauncherRuntimeResult,
} from '@/features/census/components/patient-row/patientRowOrbitalLauncherRuntimeSupport';

export { HOVER_EXIT_GRACE_MS };

/* ================================================================
 * SECTION INDEX
 * 1. Hook State & Refs            (line ~37)
 * 2. Ref Synchronization          (line ~56)
 * 3. Hover Grace Timer            (line ~72)
 * 4. Visibility & Media Query     (line ~108)
 * 5. Row Event Listeners          (line ~150)
 * 6. Global Ownership Events      (line ~281)
 * 7. Trigger Visibility Logic     (line ~316)
 * 8. Return Value                 (line ~348)
 * ================================================================ */

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

// === HOOK STATE & REFS ===

export const usePatientRowOrbitalLauncherRuntime = ({
  hasQuickActions,
  isOpen,
  launcherOffset,
  wrapperWidth,
  wrapperHeight,
  triggerCenterX,
  triggerCenterY,
}: UsePatientRowOrbitalLauncherRuntimeParams): UsePatientRowOrbitalLauncherRuntimeResult => {
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const [supportsHoverFine, setSupportsHoverFine] = React.useState(resolveSupportsHoverFine);
  const [isRowHovered, setIsRowHovered] = React.useState(false);
  const [isLauncherHovered, setIsLauncherHovered] = React.useState(false);
  const [isHoverGraceActive, setIsHoverGraceActive] = React.useState(false);
  const [position, setPosition] = React.useState<LauncherPosition | null>(null);
  const [rowId, setRowId] = React.useState<string | null>(null);
  const [activeLauncherRowId, setActiveLauncherRowId] = React.useState<string | null>(null);
  const [ownerLauncherRowId, setOwnerLauncherRowId] = React.useState<string | null>(null);
  const ownerLauncherRowIdRef = React.useRef<string | null>(null);
  const hoverExitTimerRef = React.useRef<number | null>(null);

  // === REF SYNCHRONIZATION ===

  // Refs mirror the latest state values so timer callbacks avoid stale closures.
  const isOpenRef = React.useRef(isOpen);
  const isLauncherHoveredRef = React.useRef(isLauncherHovered);
  const isRowHoveredRef = React.useRef(isRowHovered);
  const rowIdRef = React.useRef(rowId);

  // Keep refs in sync with their corresponding state values.
  React.useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);
  React.useEffect(() => {
    isLauncherHoveredRef.current = isLauncherHovered;
  }, [isLauncherHovered]);
  React.useEffect(() => {
    isRowHoveredRef.current = isRowHovered;
  }, [isRowHovered]);
  React.useEffect(() => {
    rowIdRef.current = rowId;
  }, [rowId]);
  React.useEffect(() => {
    ownerLauncherRowIdRef.current = ownerLauncherRowId;
  }, [ownerLauncherRowId]);

  // === HOVER GRACE TIMER ===

  const clearHoverExitTimer = React.useCallback(() => {
    if (hoverExitTimerRef.current !== null && typeof window !== 'undefined') {
      window.clearTimeout(hoverExitTimerRef.current);
      hoverExitTimerRef.current = null;
    }
  }, []);

  const claimLauncherOwnership = React.useCallback(
    (nextRowId: string | null) => {
      clearHoverExitTimer();
      setIsHoverGraceActive(true);
      if (nextRowId) {
        dispatchLauncherOwnerChange(nextRowId);
      }
    },
    [clearHoverExitTimer]
  );

  const activateHoveredRow = React.useCallback(
    (nextRowId: string | null, syncPosition: () => void) => {
      claimLauncherOwnership(nextRowId);
      setIsRowHovered(true);
      syncPosition();
    },
    [claimLauncherOwnership]
  );

  /**
   * Starts the hover-exit grace period. After `HOVER_EXIT_GRACE_MS` the
   * timer checks whether the pointer truly left (via refs to avoid stale
   * state) and releases ownership if so.
   */
  const armHoverGrace = React.useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    clearHoverExitTimer();
    setIsHoverGraceActive(true);
    hoverExitTimerRef.current = window.setTimeout(() => {
      setIsHoverGraceActive(false);
      // Read current values from refs -- the closure captures the ref
      // objects (stable) not the state values (potentially stale).
      if (
        ownerLauncherRowIdRef.current === rowIdRef.current &&
        !isOpenRef.current &&
        !isLauncherHoveredRef.current &&
        !isRowHoveredRef.current
      ) {
        dispatchLauncherOwnerChange(null);
      }
      hoverExitTimerRef.current = null;
    }, HOVER_EXIT_GRACE_MS);
  }, [clearHoverExitTimer]);

  // === VISIBILITY & MEDIA QUERY ===

  // --- visibilitychange: flush hover state when the tab goes to background ---
  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        clearHoverExitTimer();
        setIsRowHovered(false);
        setIsLauncherHovered(false);
        setIsHoverGraceActive(false);
        if (ownerLauncherRowIdRef.current === rowIdRef.current) {
          dispatchLauncherOwnerChange(null);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearHoverExitTimer]);

  // --- Media-query listener: track hover+fine capability changes ---
  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQuery = window.matchMedia(HOVER_FINE_MEDIA_QUERY);
    const sync = (event?: MediaQueryListEvent) => {
      setSupportsHoverFine(event ? event.matches : mediaQuery.matches);
    };

    sync();
    mediaQuery.addEventListener('change', sync);
    return () => {
      mediaQuery.removeEventListener('change', sync);
    };
  }, []);

  // === ROW EVENT LISTENERS ===

  // --- Row event listeners: hover, focus, position syncing ---
  React.useEffect(() => {
    const row = resolveRowElement(anchorRef.current);
    if (!row) {
      return;
    }

    const resolvedRowId = resolveRowId(row);
    setRowId(resolvedRowId);

    const syncPosition = () => {
      setPosition(
        resolveLauncherPosition(
          row,
          launcherOffset,
          wrapperWidth,
          wrapperHeight,
          triggerCenterX,
          triggerCenterY
        )
      );
    };

    /**
     * Instead of simple mouseenter/mouseleave, we use mousemove to
     * restrict the activation zone to the left side of the row (up to
     * and including the RUT column). Moving the pointer right of the
     * RUT cell is treated as leaving the activation zone.
     */
    const activateRowHover = () => {
      if (!isRowHoveredRef.current) {
        activateHoveredRow(resolvedRowId, syncPosition);
      }
    };

    const deactivateRowHover = () => {
      if (isRowHoveredRef.current) {
        setIsRowHovered(false);
        armHoverGrace();
      }
    };

    const handleRowMouseMove = (event: MouseEvent) => {
      const inZone = isPointerInActivationZone(event.clientX, row);

      if (inZone) {
        activateRowHover();
      } else {
        deactivateRowHover();
      }
    };

    const handleGlobalMouseMove = (event: MouseEvent) => {
      const inExternalLeftBand = isPointerInExternalLeftActivationBand(
        event.clientX,
        event.clientY,
        row
      );
      const targetInsideRow = event.target instanceof Node && row.contains(event.target);

      if (inExternalLeftBand) {
        activateRowHover();
      } else if (!targetInsideRow) {
        deactivateRowHover();
      }
    };

    const handleRowMouseLeave = () => {
      deactivateRowHover();
    };

    const handleFocusIn = () => {
      activateHoveredRow(resolvedRowId, syncPosition);
    };

    const handleFocusOut = (event: FocusEvent) => {
      if (event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) {
        return;
      }
      setIsRowHovered(false);
      armHoverGrace();
    };

    syncPosition();

    row.addEventListener('mousemove', handleRowMouseMove);
    row.addEventListener('mouseleave', handleRowMouseLeave);
    row.addEventListener('focusin', handleFocusIn);
    row.addEventListener('focusout', handleFocusOut);
    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('resize', syncPosition);
    window.addEventListener('scroll', syncPosition, true);

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(syncPosition);
      resizeObserver.observe(row);
    }

    return () => {
      row.removeEventListener('mousemove', handleRowMouseMove);
      row.removeEventListener('mouseleave', handleRowMouseLeave);
      row.removeEventListener('focusin', handleFocusIn);
      row.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('resize', syncPosition);
      window.removeEventListener('scroll', syncPosition, true);
      resizeObserver?.disconnect();
      clearHoverExitTimer();
    };
  }, [
    activateHoveredRow,
    armHoverGrace,
    clearHoverExitTimer,
    launcherOffset,
    triggerCenterX,
    triggerCenterY,
    wrapperHeight,
    wrapperWidth,
  ]);

  // === GLOBAL OWNERSHIP EVENTS ===

  // --- Global ownership event listeners ---
  React.useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleOpenChange = (event: Event) => {
      const detail = (event as CustomEvent<LauncherActiveChangeDetail>).detail;
      setActiveLauncherRowId(detail?.rowId ?? null);
    };
    const handleOwnerChange = (event: Event) => {
      const detail = (event as CustomEvent<LauncherActiveChangeDetail>).detail;
      setOwnerLauncherRowId(detail?.rowId ?? null);
    };

    window.addEventListener(LAUNCHER_OPEN_EVENT, handleOpenChange as EventListener);
    window.addEventListener(LAUNCHER_OWNER_EVENT, handleOwnerChange as EventListener);
    return () => {
      window.removeEventListener(LAUNCHER_OPEN_EVENT, handleOpenChange as EventListener);
      window.removeEventListener(LAUNCHER_OWNER_EVENT, handleOwnerChange as EventListener);
    };
  }, []);

  // --- Broadcast open state changes ---
  React.useEffect(() => {
    if (!rowId || !isOpen) {
      return;
    }

    dispatchLauncherOpenChange(rowId);
    return () => {
      dispatchLauncherOpenChange(null);
    };
  }, [isOpen, rowId]);

  // === TRIGGER VISIBILITY LOGIC ===

  const canRevealTrigger = resolveLauncherTriggerVisibility({
    hasQuickActions,
    supportsHoverFine,
    isOpen,
    isLauncherHovered,
    isRowHovered,
    isHoverGraceActive,
    rowId,
    activeLauncherRowId,
    ownerLauncherRowId,
  });

  const { phase, showTrigger } = usePatientRowOrbitalLauncherMachine({
    canRevealTrigger,
    isOpen,
    supportsHoverFine,
  });

  // === RETURN VALUE ===

  return {
    anchorRef,
    position,
    phase,
    showTrigger,
    supportsHoverFine,
    handleLauncherMouseEnter: () => {
      claimLauncherOwnership(rowId);
      setIsLauncherHovered(true);
    },
    handleLauncherMouseLeave: () => {
      setIsLauncherHovered(false);
      armHoverGrace();
    },
  };
};
