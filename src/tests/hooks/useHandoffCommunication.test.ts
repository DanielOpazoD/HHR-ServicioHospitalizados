import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

import { useHandoffCommunication } from '@/hooks/useHandoffCommunication';
import type { DailyRecord } from '@/types';
import type { MessageTemplate } from '@/services/integrations/whatsapp/whatsappService';
import { DataFactory } from '@/tests/factories/DataFactory';

const mockWriteClipboardText = vi.fn();
const mockOpen = vi.fn();

vi.mock('@/shared/runtime/browserWindowRuntime', () => ({
  defaultBrowserWindowRuntime: {
    getLocationOrigin: () => 'https://hhr.test',
    open: (...args: unknown[]) => mockOpen(...args),
  },
  writeClipboardText: (...args: unknown[]) => mockWriteClipboardText(...args),
}));

vi.mock('@/services/integrations/whatsapp/whatsappService', () => ({
  getWhatsAppConfig: vi.fn(),
  getMessageTemplates: vi.fn(),
}));

import { getMessageTemplates } from '@/services/integrations/whatsapp/whatsappService';

describe('useHandoffCommunication', () => {
  const onSuccess = vi.fn();
  const ensureMedicalHandoffSignatureLink = vi.fn();
  const createRecord = (overrides?: Partial<DailyRecord>): DailyRecord =>
    DataFactory.createMockDailyRecord('2026-02-15', {
      beds: {},
      discharges: [],
      transfers: [],
      cma: [],
      lastUpdated: '',
      nurses: [],
      activeExtraBeds: [],
      ...overrides,
    });

  beforeEach(() => {
    vi.clearAllMocks();
    ensureMedicalHandoffSignatureLink.mockResolvedValue({
      status: 'success',
      data: {
        handoffUrl: 'https://hhr.test?mode=signature&date=2026-02-15&scope=all&token=test-token',
      },
      issues: [],
    });
  });

  it('copies signature link using runtime clipboard adapter', async () => {
    mockWriteClipboardText.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useHandoffCommunication(
        createRecord(),
        [],
        vi.fn(),
        ensureMedicalHandoffSignatureLink,
        onSuccess
      )
    );

    act(() => {
      result.current.handleShareLink();
    });

    await waitFor(() => {
      expect(mockWriteClipboardText).toHaveBeenCalledWith(
        'https://hhr.test?mode=signature&date=2026-02-15&scope=all&token=test-token'
      );
      expect(onSuccess).toHaveBeenCalledWith(
        'Enlace copiado',
        'El link para firma médica de todos los pacientes ha sido copiado al portapapeles.'
      );
    });
  });

  it('copies differentiated UPC signature link', async () => {
    mockWriteClipboardText.mockResolvedValue(undefined);
    ensureMedicalHandoffSignatureLink.mockResolvedValue({
      status: 'success',
      data: {
        handoffUrl: 'https://hhr.test?mode=signature&date=2026-02-15&scope=upc&token=upc-token',
      },
      issues: [],
    });

    const { result } = renderHook(() =>
      useHandoffCommunication(
        createRecord(),
        [],
        vi.fn(),
        ensureMedicalHandoffSignatureLink,
        onSuccess
      )
    );

    act(() => {
      result.current.handleShareLink('upc');
    });

    await waitFor(() => {
      expect(mockWriteClipboardText).toHaveBeenCalledWith(
        'https://hhr.test?mode=signature&date=2026-02-15&scope=upc&token=upc-token'
      );
      expect(onSuccess).toHaveBeenCalledWith(
        'Enlace copiado',
        'El link para firma médica de UPC ha sido copiado al portapapeles.'
      );
    });
  });

  it('reports clipboard runtime error when copy fails', async () => {
    mockWriteClipboardText.mockRejectedValue(new Error('Clipboard blocked'));

    const { result } = renderHook(() =>
      useHandoffCommunication(
        createRecord(),
        [],
        vi.fn(),
        ensureMedicalHandoffSignatureLink,
        onSuccess
      )
    );

    act(() => {
      result.current.handleShareLink();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('Clipboard blocked');
    });
  });

  it('shows domain failure without trying to copy when link generation is blocked', async () => {
    ensureMedicalHandoffSignatureLink.mockResolvedValue({
      status: 'failed',
      data: null,
      issues: [
        {
          kind: 'permission',
          message: 'El médico especialista solo puede editar la entrega médica del día actual.',
        },
      ],
    });

    const { result } = renderHook(() =>
      useHandoffCommunication(
        createRecord(),
        [],
        vi.fn(),
        ensureMedicalHandoffSignatureLink,
        onSuccess
      )
    );

    act(() => {
      result.current.handleShareLink();
    });

    await waitFor(() => {
      expect(mockWriteClipboardText).not.toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(
        'El médico especialista solo puede editar la entrega médica del día actual.'
      );
    });
  });

  it('opens manual WhatsApp URL through runtime adapter', async () => {
    const templates: MessageTemplate[] = [
      { name: 'handoff', type: 'handoff', content: 'handoff-template' },
    ];
    vi.mocked(getMessageTemplates).mockResolvedValue(templates);

    const record = createRecord({
      beds: {
        B1: DataFactory.createMockPatient('B1', { patientName: 'Paciente', isBlocked: false }),
      },
      medicalHandoffDoctor: 'Dr. Test',
    });

    const { result } = renderHook(() =>
      useHandoffCommunication(
        record,
        [{ id: 'B1' }],
        vi.fn(),
        ensureMedicalHandoffSignatureLink,
        onSuccess
      )
    );

    await act(async () => {
      await result.current.handleSendWhatsAppManual();
    });

    expect(mockOpen).toHaveBeenCalled();
    expect(String(mockOpen.mock.calls[0]?.[0] || '')).toContain(
      'https://api.whatsapp.com/send?text='
    );
  });
});
