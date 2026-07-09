import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { TransferRequest } from '@/types/transferRequestTypes';
import type { GeneratedDocument, QuestionnaireResponse } from '@/types/transferDocuments';
import {
  buildTransferDocumentSignature,
  buildTransferPatientData,
  prepareTransferDocumentPackage,
} from '@/hooks/controllers/transferDocumentPackageController';
import {
  createDailyRecordFixture,
  createPatientBedFixture,
} from '@/tests/support/dailyRecordFixtures';

const mockGenerateTransferDocuments = vi.fn();

vi.mock('@/constants/hospitalConfigs', () => ({
  getHospitalConfigById: vi
    .fn()
    .mockReturnValue({ id: 'hospital-salvador', name: 'Hospital Salvador' }),
}));

vi.mock('@/services/transfers/documentGeneratorService', () => ({
  generateTransferDocuments: (...args: unknown[]) => mockGenerateTransferDocuments(...args),
}));

const record = createDailyRecordFixture({
  date: '2026-03-02',
  beds: {
    BED_H1: createPatientBedFixture('BED_H1', {
      birthDate: '1980-01-02',
    }),
  },
});

const transfer = {
  id: 'transfer-1',
  patientId: 'patient-1',
  bedId: 'BED_H1',
  patientSnapshot: {
    name: 'Paciente Demo',
    rut: '1-9',
    age: 46,
    sex: 'F',
    diagnosis: 'Dx',
    admissionDate: '2026-02-28',
  },
  destinationHospital: 'Hospital Del Salvador',
  transferReason: 'Motivo',
  requestingDoctor: 'Dr Demo',
  customFields: {},
  status: 'REQUESTED',
  statusHistory: [],
  requestDate: '2026-03-02',
  createdAt: '2026-03-02T10:00:00.000Z',
  updatedAt: '2026-03-02T10:00:00.000Z',
  createdBy: 'tester',
} as TransferRequest;

const responses: QuestionnaireResponse = {
  responses: [],
  completedAt: '2026-03-02T10:00:00.000Z',
  completedBy: 'tester',
};

const generatedDocument: GeneratedDocument = {
  fileName: 'traslado.docx',
  templateId: 'template',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  blob: new Blob(['demo']),
  generatedAt: '2026-03-02T10:00:00.000Z',
};

describe('transferDocumentPackageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds patient data from transfer snapshot and current bed context', () => {
    const patientData = buildTransferPatientData(record, transfer);

    expect(patientData.patientName).toBe('Paciente Demo');
    expect(patientData.birthDate).toBe('1980-01-02');
    expect(patientData.bedName).toBe('H1');
  });

  it('uses cache when the signature is unchanged', async () => {
    const patientData = buildTransferPatientData(record, transfer);
    const signature = buildTransferDocumentSignature(
      transfer,
      'hospital-salvador',
      responses,
      patientData
    );
    const cache = new Map([
      [
        transfer.id,
        {
          signature,
          documents: [generatedDocument],
          patientData,
        },
      ],
    ]);

    const result = await prepareTransferDocumentPackage({
      cache,
      record,
      transfer,
      hospitalId: 'hospital-salvador',
      responses,
      updateTransfer: vi.fn(),
      persistResponses: false,
    });

    expect(result.kind).toBe('cached');
    expect(mockGenerateTransferDocuments).not.toHaveBeenCalled();
  });

  it('persists questionnaire responses only when requested and caches generated documents', async () => {
    const updateTransfer = vi.fn().mockResolvedValue(undefined);
    mockGenerateTransferDocuments.mockResolvedValue([generatedDocument]);

    const cache = new Map();
    const result = await prepareTransferDocumentPackage({
      cache,
      record,
      transfer,
      hospitalId: 'hospital-salvador',
      responses,
      updateTransfer,
      persistResponses: true,
    });

    expect(result.kind).toBe('success');
    expect(updateTransfer).toHaveBeenCalledWith(transfer.id, {
      questionnaireResponses: responses,
    });
    expect(cache.has(transfer.id)).toBe(true);
  });
});
