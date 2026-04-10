import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockSendWhatsAppMessage = vi.fn();
const mockGetWhatsAppConfig = vi.fn();
const mockGetMessageTemplates = vi.fn();
const mockFormatHandoffMessage = vi.fn();
const mockSaveMessageTemplates = vi.fn();

vi.mock('@/services/integrations/whatsapp/whatsappService', () => ({
  sendWhatsAppMessage: (...args: unknown[]) => mockSendWhatsAppMessage(...args),
  getWhatsAppConfig: (...args: unknown[]) => mockGetWhatsAppConfig(...args),
  getMessageTemplates: (...args: unknown[]) => mockGetMessageTemplates(...args),
  formatHandoffMessage: (...args: unknown[]) => mockFormatHandoffMessage(...args),
  saveMessageTemplates: (...args: unknown[]) => mockSaveMessageTemplates(...args),
  saveManualShift: vi.fn().mockResolvedValue({ success: true }),
  subscribeToCurrentShift: vi.fn((cb: (data: null) => void) => {
    cb(null);
    return () => undefined;
  }),
  fetchShiftsFromGroup: vi.fn().mockResolvedValue({ success: true, message: 'Found shifts' }),
  getDefaultTemplates: vi.fn(() => []),
  checkBotHealth: vi.fn().mockResolvedValue({ status: 'ok', whatsapp: 'connected' }),
  getWhatsAppGroups: vi.fn().mockResolvedValue([]),
  updateWhatsAppConfig: vi.fn().mockResolvedValue(true),
  logWhatsAppOperation: vi.fn(),
}));

vi.mock('@/hooks/useWhatsAppQuery', () => ({
  useWhatsAppConfigQuery: vi.fn(() => ({
    data: {
      enabled: true,
      status: 'connected',
      shiftParser: { enabled: true, sourceGroupId: 'g1' },
      handoffNotifications: { enabled: true, targetGroupId: 'g2', autoSendTime: '17:00' },
    },
    isLoading: false,
    refetch: vi.fn(),
  })),
  useWhatsAppHealthQuery: vi.fn(() => ({
    data: 'connected',
    isLoading: false,
    refetch: vi.fn(),
  })),
  useWhatsAppGroupsQuery: vi.fn(() => ({
    data: [
      { id: 'g1', name: 'Grupo Turnos' },
      { id: 'g2', name: 'Grupo Entregas' },
    ],
    isLoading: false,
  })),
  useUpdateWhatsAppConfigMutation: vi.fn(() => ({
    mutate: vi.fn(),
    isPending: false,
    isSuccess: false,
    isError: false,
  })),
  whatsappKeys: { all: ['whatsapp'], config: () => ['whatsapp', 'config'] },
}));

vi.mock('@/hooks/useShiftPanel', () => ({
  useShiftPanel: vi.fn(() => ({
    shift: null,
    loading: false,
    showOriginal: false,
    showImportModal: false,
    setShowImportModal: vi.fn(),
    importMessage: '',
    setImportMessage: vi.fn(),
    importing: false,
    importError: null,
    fetching: false,
    fetchResult: null,
    handleImport: vi.fn(),
    handleFetchFromGroup: vi.fn(),
    toggleViewMode: vi.fn(),
  })),
}));

vi.mock('@/shared/runtime/browserWindowRuntime', () => ({
  defaultBrowserWindowRuntime: {
    open: vi.fn(),
    alert: vi.fn(),
  },
}));

vi.mock('@/utils/dateFormattingUtils', () => ({
  formatDateDDMMYYYY: (d: string) => d,
}));

/* ------------------------------------------------------------------ */
/*  Lazy imports (after mocks registered)                              */
/* ------------------------------------------------------------------ */

import { WhatsAppSendButton } from '@/features/whatsapp/components/WhatsAppSendButton';
import { WhatsAppIntegrationView } from '@/features/whatsapp/components/WhatsAppIntegrationView';
import { ImportModal } from '@/features/whatsapp/components/components/ImportModal';
import { StaffCard } from '@/features/whatsapp/components/components/StaffCard';
import {
  formatHandoffMessage,
  getDefaultTemplates,
} from '@/services/integrations/whatsapp/whatsappTemplatesStore';
import { buildBotUrl } from '@/services/integrations/whatsapp/whatsappBotRuntime';
import { useShiftPanel } from '@/hooks/useShiftPanel';
import { ShiftPanelView } from '@/features/whatsapp/components/ShiftPanelView';

/* ------------------------------------------------------------------ */
/*  Test data                                                          */
/* ------------------------------------------------------------------ */

const handoffData = {
  id: 'h-1',
  date: '2026-03-10',
  signedBy: 'Dr. Perez',
  signedAt: '14:00',
  hospitalized: 12,
  freeBeds: 5,
  newAdmissions: 2,
  discharges: 1,
};

/* ================================================================== */
/*  WhatsAppSendButton                                                 */
/* ================================================================== */

describe('WhatsAppSendButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders idle state with send button', () => {
    render(<WhatsAppSendButton handoffData={handoffData} />);
    expect(screen.getByText('Enviar a WhatsApp')).toBeInTheDocument();
  });

  it('renders sent state when whatsappStatus.sent is true', () => {
    render(
      <WhatsAppSendButton
        handoffData={handoffData}
        whatsappStatus={{ sent: true, sentAt: '14:30', method: 'MANUAL' }}
      />
    );
    expect(screen.getByText('Enviado a WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('(14:30)')).toBeInTheDocument();
  });

  it('shows automatic label when method is AUTO', () => {
    render(
      <WhatsAppSendButton
        handoffData={handoffData}
        whatsappStatus={{ sent: true, sentAt: '17:00', method: 'AUTO' }}
      />
    );
    expect(screen.getByText('(17:00)')).toBeInTheDocument();
    expect(screen.getByText(/autom/i)).toBeInTheDocument();
  });

  it('shows sending state while in progress', async () => {
    mockGetWhatsAppConfig.mockReturnValue(new Promise(() => {})); // never resolves
    render(<WhatsAppSendButton handoffData={handoffData} />);

    fireEvent.click(screen.getByText('Enviar a WhatsApp'));

    await waitFor(() => {
      expect(screen.getByText('Enviando...')).toBeInTheDocument();
    });
  });

  it('shows error state and retry button when send fails', async () => {
    mockGetWhatsAppConfig.mockResolvedValue({
      handoffNotifications: { enabled: true, targetGroupId: 'g1' },
    });
    mockGetMessageTemplates.mockResolvedValue([
      { id: '1', type: 'handoff', content: 'test {{date}}' },
    ]);
    mockFormatHandoffMessage.mockReturnValue('formatted');
    mockSendWhatsAppMessage.mockResolvedValue({
      success: false,
      error: 'Connection lost',
    });

    render(<WhatsAppSendButton handoffData={handoffData} />);
    fireEvent.click(screen.getByText('Enviar a WhatsApp'));

    await waitFor(() => {
      expect(screen.getByText('Connection lost')).toBeInTheDocument();
    });

    expect(screen.getByText('Reintentar')).toBeInTheDocument();
  });

  it('shows error when notifications are disabled', async () => {
    mockGetWhatsAppConfig.mockResolvedValue({
      handoffNotifications: { enabled: false, targetGroupId: 'g1' },
    });

    render(<WhatsAppSendButton handoffData={handoffData} />);
    fireEvent.click(screen.getByText('Enviar a WhatsApp'));

    await waitFor(() => {
      expect(screen.getByText(/desactivadas/i)).toBeInTheDocument();
    });
  });

  it('shows error when no target group is configured', async () => {
    mockGetWhatsAppConfig.mockResolvedValue({
      handoffNotifications: { enabled: true, targetGroupId: '' },
    });

    render(<WhatsAppSendButton handoffData={handoffData} />);
    fireEvent.click(screen.getByText('Enviar a WhatsApp'));

    await waitFor(() => {
      expect(screen.getByText(/no configurado/i)).toBeInTheDocument();
    });
  });

  it('shows error when no message template exists', async () => {
    mockGetWhatsAppConfig.mockResolvedValue({
      handoffNotifications: { enabled: true, targetGroupId: 'g1' },
    });
    mockGetMessageTemplates.mockResolvedValue([]);

    render(<WhatsAppSendButton handoffData={handoffData} />);
    fireEvent.click(screen.getByText('Enviar a WhatsApp'));

    await waitFor(() => {
      expect(screen.getByText(/plantilla/i)).toBeInTheDocument();
    });
  });

  it('calls onSent callback after successful send', async () => {
    mockGetWhatsAppConfig.mockResolvedValue({
      handoffNotifications: { enabled: true, targetGroupId: 'g1' },
    });
    mockGetMessageTemplates.mockResolvedValue([
      { id: '1', type: 'handoff', content: 'test {{date}}' },
    ]);
    mockFormatHandoffMessage.mockReturnValue('formatted');
    mockSendWhatsAppMessage.mockResolvedValue({
      success: true,
      messageId: 'msg-1',
    });

    const onSent = vi.fn();
    render(<WhatsAppSendButton handoffData={handoffData} onSent={onSent} />);
    fireEvent.click(screen.getByText('Enviar a WhatsApp'));

    await waitFor(() => {
      expect(onSent).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    });
  });
});

/* ================================================================== */
/*  WhatsAppIntegrationView                                            */
/* ================================================================== */

describe('WhatsAppIntegrationView', () => {
  it('renders header and default shifts tab', () => {
    render(<WhatsAppIntegrationView />);
    expect(screen.getByText('WhatsApp')).toBeInTheDocument();
    expect(screen.getByText('Turnos Pabellón')).toBeInTheDocument();
  });

  it('switches between tabs', () => {
    render(<WhatsAppIntegrationView />);

    fireEvent.click(screen.getByText('Plantillas'));
    // Templates tab should be active now

    fireEvent.click(screen.getByText('Configuración'));
    // Config tab should be active now
  });

  it('shows all three tab labels', () => {
    render(<WhatsAppIntegrationView />);
    expect(screen.getByText('Turnos Pabellón')).toBeInTheDocument();
    expect(screen.getByText('Plantillas')).toBeInTheDocument();
    expect(screen.getByText('Configuración')).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  ImportModal                                                        */
/* ================================================================== */

describe('ImportModal', () => {
  const baseProps = {
    message: '',
    setMessage: vi.fn(),
    onImport: vi.fn(),
    onClose: vi.fn(),
    importing: false,
    error: null as string | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the import modal with header and textarea', () => {
    render(<ImportModal {...baseProps} />);
    expect(screen.getByText('Importar Turno de Pabellón')).toBeInTheDocument();
  });

  it('disables import button when message is empty', () => {
    render(<ImportModal {...baseProps} />);
    const importButton = screen.getByText('Importar Turno');
    expect(importButton.closest('button')).toBeDisabled();
  });

  it('enables import button when message has content', () => {
    render(<ImportModal {...baseProps} message="turno data here" />);
    const importButton = screen.getByText('Importar Turno');
    expect(importButton.closest('button')).not.toBeDisabled();
  });

  it('shows importing state', () => {
    render(<ImportModal {...baseProps} message="data" importing={true} />);
    expect(screen.getByText('Importando...')).toBeInTheDocument();
  });

  it('shows error message when provided', () => {
    render(<ImportModal {...baseProps} error="Error parsing message" />);
    expect(screen.getByText(/Error parsing message/)).toBeInTheDocument();
  });

  it('calls onClose when cancel is clicked', () => {
    render(<ImportModal {...baseProps} />);
    fireEvent.click(screen.getByText('Cancelar'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when X button is clicked', () => {
    render(<ImportModal {...baseProps} />);
    fireEvent.click(screen.getByLabelText('Cerrar'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onImport when import button is clicked', () => {
    render(<ImportModal {...baseProps} message="turno content" />);
    fireEvent.click(screen.getByText('Importar Turno'));
    expect(baseProps.onImport).toHaveBeenCalledTimes(1);
  });
});

/* ================================================================== */
/*  ShiftPanelView empty state                                         */
/* ================================================================== */

describe('ShiftPanelView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows empty state when no shift is available', () => {
    render(<ShiftPanelView />);
    expect(screen.getByText('No hay turno vigente')).toBeInTheDocument();
    expect(screen.getByText(/Buscar en Grupo de WhatsApp/i)).toBeInTheDocument();
    expect(screen.getByText('Importar Manualmente')).toBeInTheDocument();
  });

  it('shows loading spinner when loading is true', () => {
    vi.mocked(useShiftPanel).mockReturnValue({
      shift: null,
      loading: true,
      showOriginal: false,
      showImportModal: false,
      setShowImportModal: vi.fn(),
      importMessage: '',
      setImportMessage: vi.fn(),
      importing: false,
      importError: '',
      fetching: false,
      fetchResult: null,
      handleImport: vi.fn(),
      handleFetchFromGroup: vi.fn(),
      toggleViewMode: vi.fn(),
    });

    const { container } = render(<ShiftPanelView />);
    expect(container.querySelector('.animate-spin')).not.toBeNull();
  });

  it('renders staff grid when shift has staff data', () => {
    vi.mocked(useShiftPanel).mockReturnValue({
      shift: {
        startDate: '2026-03-10',
        endDate: '2026-03-17',
        source: 'whatsapp' as const,
        parsedAt: '2026-03-10T10:00:00.000Z',
        staff: [
          {
            role: 'Cirujana',
            name: 'Dra. Maria',
            phone: '+56912345678',
            whatsappUrl: 'https://wa.me/56912345678',
          },
        ],
        originalMessage: 'Turno pabellon...',
      },
      loading: false,
      showOriginal: false,
      showImportModal: false,
      setShowImportModal: vi.fn(),
      importMessage: '',
      setImportMessage: vi.fn(),
      importing: false,
      importError: '',
      fetching: false,
      fetchResult: null,
      handleImport: vi.fn(),
      handleFetchFromGroup: vi.fn(),
      toggleViewMode: vi.fn(),
    });

    render(<ShiftPanelView />);
    expect(screen.getByText('Turno Pabellón')).toBeInTheDocument();
    expect(screen.getByText('Dra. Maria')).toBeInTheDocument();
    expect(screen.getByText('Cirujana')).toBeInTheDocument();
  });
});

/* ================================================================== */
/*  StaffCard extended                                                 */
/* ================================================================== */

describe('StaffCard extended', () => {
  it('renders member role, name and phone', () => {
    const member = {
      role: 'Anestesista',
      name: 'Dr. Juan',
      phone: '+56999887766',
      whatsappUrl: 'https://wa.me/56999887766',
    };

    render(<StaffCard member={member} />);
    expect(screen.getByText('Anestesista')).toBeInTheDocument();
    expect(screen.getByText('Dr. Juan')).toBeInTheDocument();
  });

  it('renders notes when provided', () => {
    const member = {
      role: 'EU',
      name: 'Ana',
      phone: '+56900000000',
      whatsappUrl: 'https://wa.me/56900000000',
      notes: 'Hasta las 20:00',
    };

    render(<StaffCard member={member} />);
    expect(screen.getByText(/Hasta las 20:00/)).toBeInTheDocument();
  });

  it('renders replacement info when present', () => {
    const member = {
      role: 'EU',
      name: 'Ana',
      phone: '+56900000000',
      whatsappUrl: 'https://wa.me/56900000000',
      replacement: {
        name: 'Carmen',
        phone: '+56911111111',
        whatsappUrl: 'https://wa.me/56911111111',
        startDate: '2026-03-13',
      },
    };

    render(<StaffCard member={member} />);
    expect(screen.getByText('Carmen')).toBeInTheDocument();
    expect(screen.getByText('+56911111111')).toBeInTheDocument();
  });

  it('does not render replacement section when absent', () => {
    const member = {
      role: 'EU',
      name: 'Ana',
      phone: '+56900000000',
      whatsappUrl: 'https://wa.me/56900000000',
    };

    render(<StaffCard member={member} />);
    expect(screen.queryByText('Luego:')).not.toBeInTheDocument();
  });
});

/* ================================================================== */
/*  formatHandoffMessage (template store)                              */
/* ================================================================== */

describe('formatHandoffMessage', () => {
  it('replaces all template variables', () => {
    const template =
      'Date: {{date}}, By: {{signedBy}}, At: {{signedAt}}, Hosp: {{hospitalized}}, Free: {{freeBeds}}, New: {{newAdmissions}}, Disc: {{discharges}}, URL: {{handoffUrl}}, Crit: {{criticalPatients}}';

    const result = formatHandoffMessage(template, {
      date: '2026-03-10',
      signedBy: 'Dr. Test',
      signedAt: '14:00',
      hospitalized: 12,
      freeBeds: 5,
      newAdmissions: 2,
      discharges: 1,
      handoffUrl: 'https://app.test/handoff/1',
      criticalPatients: 3,
    });

    expect(result).toContain('2026-03-10');
    expect(result).toContain('Dr. Test');
    expect(result).toContain('14:00');
    expect(result).toContain('12');
    expect(result).toContain('5');
    expect(result).toContain('2');
    expect(result).toContain('1');
    expect(result).toContain('https://app.test/handoff/1');
    expect(result).toContain('3');
  });

  it('defaults criticalPatients to 0 when not provided', () => {
    const template = 'Critical: {{criticalPatients}}';
    const result = formatHandoffMessage(template, {
      date: '',
      signedBy: '',
      signedAt: '',
      hospitalized: 0,
      freeBeds: 0,
      newAdmissions: 0,
      discharges: 0,
      handoffUrl: '',
    });
    expect(result).toBe('Critical: 0');
  });

  it('handles multiple occurrences of the same variable', () => {
    const template = '{{date}} - {{date}}';
    const result = formatHandoffMessage(template, {
      date: '2026-03-10',
      signedBy: '',
      signedAt: '',
      hospitalized: 0,
      freeBeds: 0,
      newAdmissions: 0,
      discharges: 0,
      handoffUrl: '',
    });
    expect(result).toBe('2026-03-10 - 2026-03-10');
  });
});

/* ================================================================== */
/*  getDefaultTemplates                                                */
/* ================================================================== */

describe('getDefaultTemplates', () => {
  it('returns at least one default template', () => {
    const defaults = getDefaultTemplates();
    expect(defaults.length).toBeGreaterThanOrEqual(1);
  });

  it('includes a handoff type template', () => {
    const defaults = getDefaultTemplates();
    const handoff = defaults.find(t => t.type === 'handoff');
    expect(handoff).toBeDefined();
    expect(handoff!.content).toContain('{{date}}');
  });
});

/* ================================================================== */
/*  buildBotUrl                                                        */
/* ================================================================== */

describe('buildBotUrl', () => {
  it('normalizes paths with leading slash', () => {
    const url = buildBotUrl('/health');
    expect(url).toMatch(/\/health$/);
  });

  it('adds a leading slash when path lacks one', () => {
    const url = buildBotUrl('groups');
    expect(url).toMatch(/\/groups$/);
  });
});
