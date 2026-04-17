import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================================
// Mocks
// ============================================================================

const mockDoc = {
  internal: { pageSize: { getWidth: () => 216, getHeight: () => 279 } },
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setDrawColor: vi.fn(),
  setLineWidth: vi.fn(),
  setFillColor: vi.fn(),
  setTextColor: vi.fn(),
  text: vi.fn(),
  line: vi.fn(),
  roundedRect: vi.fn(),
  addImage: vi.fn(),
  splitTextToSize: vi.fn().mockImplementation((text: string) => [text]),
  autoPrint: vi.fn(),
  output: vi.fn().mockReturnValue('blob:test'),
};

// The source does `const { default: jsPDF } = await import('jspdf')` then `new jsPDF(...)`.
// The default export must be a real constructor (class), not a plain function.
vi.mock('jspdf', () => {
  class MockJsPDF {
    internal = mockDoc.internal;
    setFont = mockDoc.setFont;
    setFontSize = mockDoc.setFontSize;
    setDrawColor = mockDoc.setDrawColor;
    setLineWidth = mockDoc.setLineWidth;
    setFillColor = mockDoc.setFillColor;
    setTextColor = mockDoc.setTextColor;
    text = mockDoc.text;
    line = mockDoc.line;
    roundedRect = mockDoc.roundedRect;
    addImage = mockDoc.addImage;
    splitTextToSize = mockDoc.splitTextToSize;
    autoPrint = mockDoc.autoPrint;
    output = mockDoc.output;
  }
  return { default: MockJsPDF };
});

vi.mock('@/services/pdf/handoffPdfUtils', () => ({
  getBase64ImageFromURL: vi.fn().mockResolvedValue('data:image/png;base64,test'),
}));

import { generateConsentPdf } from '@/features/wound-care/services/consentPdfGenerator';
import { getBase64ImageFromURL } from '@/services/pdf/handoffPdfUtils';

// ============================================================================
// Tests
// ============================================================================

describe('consentPdfGenerator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates PDF with patient data', async () => {
    await generateConsentPdf({ patientName: 'Juan Perez', patientRut: '12345678-9' });

    // Patient name should appear in the document
    const textCalls = mockDoc.text.mock.calls.map((call: any[]) => call[0]);
    expect(textCalls).toContain('Juan Perez');
  });

  it('includes hospital header', async () => {
    await generateConsentPdf({ patientName: 'Test', patientRut: '1-1' });

    const textCalls = mockDoc.text.mock.calls.map((call: any[]) => call[0]);
    expect(textCalls).toContain('HOSPITAL HANGA ROA');
  });

  it('returns the blob URL so callers can open it via the runtime adapter', async () => {
    const url = await generateConsentPdf({ patientName: 'Test', patientRut: '1-1' });

    expect(url).toBe('blob:test');
  });

  it('calls autoPrint', async () => {
    await generateConsentPdf({ patientName: 'Test', patientRut: '1-1' });

    expect(mockDoc.autoPrint).toHaveBeenCalledOnce();
  });

  it('handles logo loading failure gracefully', async () => {
    vi.mocked(getBase64ImageFromURL).mockRejectedValueOnce(new Error('Network error'));

    // Should not throw even when logo fails; still resolves to a blob URL
    await expect(generateConsentPdf({ patientName: 'Test', patientRut: '1-1' })).resolves.toBe(
      'blob:test'
    );

    // addImage should NOT have been called since the logo failed
    expect(mockDoc.addImage).not.toHaveBeenCalled();
  });

  it('formats admission date correctly', async () => {
    await generateConsentPdf({
      patientName: 'Test',
      patientRut: '1-1',
      admissionDate: '2026-04-15',
    });

    // formatDate converts 'yyyy-mm-dd' to 'dd/mm/yyyy'
    const textCalls = mockDoc.text.mock.calls.map((call: any[]) => call[0]);
    expect(textCalls).toContain('15/04/2026');
  });
});
