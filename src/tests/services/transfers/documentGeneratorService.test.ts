import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  downloadAllDocuments,
  downloadDocument,
  generateTransferDocuments,
} from '@/services/transfers/documentGeneratorService';
import type {
  GeneratedDocument,
  HospitalConfig,
  QuestionnaireResponse,
  TransferPatientData,
} from '@/types/transferDocuments';

const {
  mockFetchTemplateFromStorage,
  mockMapDataToTags,
  mockGenerateDocxFromTemplate,
  mockGenerateXlsxFromTemplate,
  mockRecordTransferDocumentGenerationFailure,
  mockRecordTransferTemplateFallback,
  mockRecordUnknownTransferTemplate,
  mockResolveTransferFallbackGenerator,
  mockZipFile,
  mockZipGenerate,
} = vi.hoisted(() => ({
  mockFetchTemplateFromStorage: vi.fn(),
  mockMapDataToTags: vi.fn(),
  mockGenerateDocxFromTemplate: vi.fn(),
  mockGenerateXlsxFromTemplate: vi.fn(),
  mockRecordTransferDocumentGenerationFailure: vi.fn(),
  mockRecordTransferTemplateFallback: vi.fn(),
  mockRecordUnknownTransferTemplate: vi.fn(),
  mockResolveTransferFallbackGenerator: vi.fn(),
  mockZipFile: vi.fn(),
  mockZipGenerate: vi.fn(() => new Blob(['zip'], { type: 'application/zip' })),
}));

vi.mock('@/services/transfers/templateGeneratorService', () => ({
  fetchTemplateFromStorage: mockFetchTemplateFromStorage,
  mapDataToTags: mockMapDataToTags,
  generateDocxFromTemplate: mockGenerateDocxFromTemplate,
  generateXlsxFromTemplate: mockGenerateXlsxFromTemplate,
}));

vi.mock('@/services/transfers/transferDocumentTelemetryController', () => ({
  recordTransferDocumentGenerationFailure: mockRecordTransferDocumentGenerationFailure,
  recordTransferTemplateFallback: mockRecordTransferTemplateFallback,
  recordUnknownTransferTemplate: mockRecordUnknownTransferTemplate,
}));

vi.mock('@/services/transfers/transferDocumentFallbackRegistry', () => ({
  resolveTransferFallbackGenerator: mockResolveTransferFallbackGenerator,
}));

vi.mock('pizzip', () => ({
  default: class MockPizZip {
    constructor() {
      mockZipFile.mockClear();
      mockZipGenerate.mockClear();
    }

    file = mockZipFile;

    generate = mockZipGenerate;
  },
}));

const patientData: TransferPatientData = {
  patientName: 'Paciente Demo',
  rut: '11.111.111-1',
  birthDate: '1986-01-01',
  age: 40,
  diagnosis: 'Neumonía',
  admissionDate: '2026-03-10',
  bedName: 'B-12',
  bedType: 'Básica',
  isUPC: false,
  originHospital: 'Hospital Hanga Roa',
};

const responses: QuestionnaireResponse = {
  responses: [],
  completedAt: '2026-03-13T10:00:00Z',
  completedBy: 'Dra. Demo',
  attendingPhysician: 'Dra. Demo',
  diagnosis: 'Neumonía',
};

const hospital: HospitalConfig = {
  id: 'hhr',
  name: 'Hospital Hanga Roa',
  code: 'HHR',
  emails: { to: [], cc: [] },
  questions: [],
  templates: [],
};

const createDocument = (name: string): GeneratedDocument => ({
  templateId: name,
  fileName: `${name}.docx`,
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  blob: {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    arrayBuffer: async () => new TextEncoder().encode(name).buffer,
  } as unknown as Blob,
  generatedAt: '2026-03-13T10:00:00.000Z',
});

describe('documentGeneratorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMapDataToTags.mockReturnValue({ paciente_nombre: 'Paciente Demo' });
    mockGenerateDocxFromTemplate.mockResolvedValue(
      new Blob(['docx'], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
    );
    mockGenerateXlsxFromTemplate.mockResolvedValue(
      new Blob(['xlsx'], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      })
    );
    mockResolveTransferFallbackGenerator.mockResolvedValue(null);
  });

  it('generates documents from available templates and preserves PDF blobs as-is', async () => {
    mockFetchTemplateFromStorage
      .mockResolvedValueOnce(
        new Blob(['docx-template'], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      )
      .mockResolvedValueOnce(
        new Blob(['xlsx-template'], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      )
      .mockResolvedValueOnce(new Blob(['pdf-template'], { type: 'application/pdf' }));

    const result = await generateTransferDocuments(patientData, responses, {
      ...hospital,
      templates: [
        {
          id: 'tapa-traslado',
          name: 'Tapa traslado',
          format: 'docx',
          enabled: true,
          requiredQuestions: [],
        },
        {
          id: 'iaas',
          name: 'Formulario IAAS',
          format: 'xlsx',
          enabled: true,
          requiredQuestions: [],
        },
        {
          id: 'manual',
          name: 'Instrucciones',
          format: 'pdf',
          enabled: true,
          requiredQuestions: [],
        },
      ],
    });

    expect(mockMapDataToTags).toHaveBeenCalledWith(patientData, responses);
    expect(mockGenerateDocxFromTemplate).toHaveBeenCalled();
    expect(mockGenerateXlsxFromTemplate).toHaveBeenCalled();
    expect(result).toHaveLength(3);
    expect(result.map(doc => doc.templateId)).toEqual(['tapa-traslado', 'iaas', 'manual']);
    expect(result[2].mimeType).toBe('application/pdf');
  });

  it('falls back to registered generators when a template blob is missing', async () => {
    const fallbackDocument = createDocument('fallback-doc');
    mockFetchTemplateFromStorage.mockResolvedValue(null);
    mockResolveTransferFallbackGenerator.mockReturnValue(
      vi.fn().mockResolvedValue(fallbackDocument)
    );

    const result = await generateTransferDocuments(patientData, responses, {
      ...hospital,
      templates: [
        {
          id: 'fallback-doc',
          name: 'Fallback',
          format: 'docx',
          enabled: true,
          requiredQuestions: [],
        },
      ],
    });

    expect(mockRecordTransferTemplateFallback).toHaveBeenCalledWith('fallback-doc', 'HHR');
    expect(result).toEqual([fallbackDocument]);
  });

  it('records unknown templates and generation failures without returning broken docs', async () => {
    mockFetchTemplateFromStorage
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('storage down'));
    mockResolveTransferFallbackGenerator.mockReturnValue(null);

    const result = await generateTransferDocuments(patientData, responses, {
      ...hospital,
      templates: [
        {
          id: 'unknown-template',
          name: 'Unknown',
          format: 'docx',
          enabled: true,
          requiredQuestions: [],
        },
        {
          id: 'broken-template',
          name: 'Broken',
          format: 'docx',
          enabled: true,
          requiredQuestions: [],
        },
      ],
    });

    expect(mockRecordUnknownTransferTemplate).toHaveBeenCalledWith('unknown-template');
    expect(mockRecordTransferDocumentGenerationFailure).toHaveBeenCalledWith(
      'broken-template',
      'HHR',
      expect.any(Error)
    );
    expect(result).toEqual([]);
  });

  it('downloads a single document through the file picker and reports cancellations', async () => {
    const writable = {
      write: vi.fn(),
      close: vi.fn(),
    };
    const showSaveFilePicker = vi
      .fn()
      .mockResolvedValueOnce({
        createWritable: vi.fn().mockResolvedValue(writable),
      })
      .mockRejectedValueOnce(new DOMException('cancelled', 'AbortError'));

    Object.defineProperty(window, 'showSaveFilePicker', {
      value: showSaveFilePicker,
      configurable: true,
      writable: true,
    });

    const result = await downloadDocument(createDocument('single-doc'));
    const cancelled = await downloadDocument(createDocument('single-doc'));

    expect(result).toBe('saved');
    expect(cancelled).toBe('cancelled');
    expect(writable.write).toHaveBeenCalled();
    expect(writable.close).toHaveBeenCalled();
  });

  it('writes all generated documents through the directory picker when available', async () => {
    const createWritable = vi.fn().mockResolvedValue({
      write: vi.fn(),
      close: vi.fn(),
    });
    const getFileHandle = vi.fn().mockResolvedValue({
      createWritable,
    });

    Object.defineProperty(window, 'showDirectoryPicker', {
      value: vi.fn().mockResolvedValue({
        getFileHandle,
      }),
      configurable: true,
      writable: true,
    });

    const result = await downloadAllDocuments([createDocument('a'), createDocument('b')]);

    expect(result).toBe('directory');
    expect(getFileHandle).toHaveBeenCalledTimes(2);
    expect(createWritable).toHaveBeenCalledTimes(2);
  });

  it('falls back to ZIP packaging when directory access is unavailable', async () => {
    const writable = {
      write: vi.fn(),
      close: vi.fn(),
    };

    Object.defineProperty(window, 'showDirectoryPicker', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(window, 'showSaveFilePicker', {
      value: vi.fn().mockResolvedValue({
        createWritable: vi.fn().mockResolvedValue(writable),
      }),
      configurable: true,
      writable: true,
    });

    const result = await downloadAllDocuments([createDocument('a'), createDocument('b')]);

    expect(result).toBe('zip');
    expect(mockZipFile).toHaveBeenCalledTimes(2);
    expect(mockZipGenerate).toHaveBeenCalledWith({
      type: 'blob',
      compression: 'DEFLATE',
    });
    expect(writable.write).toHaveBeenCalled();
  });
});
