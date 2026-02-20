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
  });

  it('copies signature link using runtime clipboard adapter', async () => {
    mockWriteClipboardText.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useHandoffCommunication(createRecord(), [], vi.fn(), onSuccess)
    );

    act(() => {
      result.current.handleShareLink();
    });

    await waitFor(() => {
      expect(mockWriteClipboardText).toHaveBeenCalledWith(
        'https://hhr.test?mode=signature&date=2026-02-15'
      );
      expect(onSuccess).toHaveBeenCalledWith(
        'Enlace copiado',
        'El link para firma médica ha sido copiado al portapapeles.'
      );
    });
  });

  it('reports clipboard runtime error when copy fails', async () => {
    mockWriteClipboardText.mockRejectedValue(new Error('Clipboard blocked'));

    const { result } = renderHook(() =>
      useHandoffCommunication(createRecord(), [], vi.fn(), onSuccess)
    );

    act(() => {
      result.current.handleShareLink();
    });

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('Clipboard blocked');
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
      useHandoffCommunication(record, [{ id: 'B1' }], vi.fn(), onSuccess)
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
