import { describe, expect, it } from 'vitest';

import {
  buildTransferDeleteDialogModel,
  resolveTransferActionsMenuState,
  shouldCloseTransferActionsMenu,
} from '@/features/transfers/components/controllers/transferTableViewController';
import type { TransferRequest } from '@/types/transferRequestTypes';

const transfer = {
  id: 'TR-1',
  patientSnapshot: { name: 'Paciente Demo' },
} as TransferRequest;

describe('transferTableViewController', () => {
  it('computes menu position and toggles when opening the same transfer twice', () => {
    const firstState = resolveTransferActionsMenuState({
      currentMenu: null,
      transfer,
      anchorRect: { right: 420, bottom: 100 },
      viewportWidth: 480,
    });

    expect(firstState).toEqual({
      transfer,
      top: 108,
      left: 140,
    });

    expect(
      resolveTransferActionsMenuState({
        currentMenu: firstState,
        transfer,
        anchorRect: { right: 420, bottom: 100 },
        viewportWidth: 480,
      })
    ).toBeNull();
  });

  it('knows when an outside click should close the actions menu', () => {
    const insideTarget = {
      closest: (selector: string) =>
        selector === '[data-transfer-actions-root="true"]' ? {} : null,
    } as unknown as HTMLElement;
    const outsideTarget = {
      closest: () => null,
    } as unknown as HTMLElement;

    expect(shouldCloseTransferActionsMenu(insideTarget)).toBe(false);
    expect(shouldCloseTransferActionsMenu(outsideTarget)).toBe(true);
    expect(shouldCloseTransferActionsMenu(null)).toBe(true);
  });

  it('builds the delete dialog model from the selected transfer', () => {
    expect(buildTransferDeleteDialogModel(transfer)).toEqual({
      title: 'Eliminar solicitud',
      description: 'Esta acción no se puede deshacer.',
      patientName: 'Paciente Demo',
    });
  });
});
