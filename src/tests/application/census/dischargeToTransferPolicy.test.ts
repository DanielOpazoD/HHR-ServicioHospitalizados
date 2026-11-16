import { describe, it, expect } from 'vitest';
import { convertDischargeToTransferRecord } from '@/application/census/dischargeToTransferPolicy';
import {
  getActiveDischarges,
  getActiveTransfers,
} from '@/application/census/movementTombstonePolicy';
import { DataFactory } from '@/tests/factories/DataFactory';

const payload = {
  evacuationMethod: 'Otro',
  evacuationMethodOther: 'Armada',
  receivingCenter: 'Otro',
  receivingCenterOther: 'Centro de prueba',
  transferEscort: 'Enfermera',
  time: '00:31',
};
const setup = () =>
  DataFactory.createMockDailyRecord('2026-11-14', {
    discharges: [
      DataFactory.createMockDischarge({
        id: 'alta-1',
        status: 'Vivo',
        movementDate: '2026-11-15',
        time: '00:31',
        clinicalEpisodeId: 'historical-episode',
        admissionDate: '2026-11-01',
        isNested: true,
        originalData: DataFactory.createMockPatient('R1', {
          clinicalEpisodeId: 'historical-episode',
        }),
        ieehData: { procedimiento: 'Preservado' },
      }),
    ],
    transfers: [],
  });
describe('discharge to transfer reclassification', () => {
  it('reclassifies once, preserving historical identity, snapshot, dates, nested status and untouched beds', () => {
    const record = setup();
    const result = convertDischargeToTransferRecord(record, 'alta-1', payload, () => 'transfer-1');
    expect(result.beds).toBe(record.beds);
    expect(getActiveDischarges(result.discharges)).toHaveLength(0);
    expect(result.discharges[0]).toEqual({
      ...record.discharges[0],
      deletedAt: expect.any(String),
      deletedBy: undefined,
      deletedReason: 'converted_to_transfer',
    });
    expect(getActiveTransfers(result.transfers)).toEqual([
      expect.objectContaining({
        ...payload,
        id: 'transfer-1',
        patientName: record.discharges[0].patientName,
        rut: record.discharges[0].rut,
        clinicalEpisodeId: 'historical-episode',
        movementDate: '2026-11-15',
        admissionDate: '2026-11-01',
        isNested: true,
        originalData: record.discharges[0].originalData,
      }),
    ]);
    expect(() =>
      convertDischargeToTransferRecord(result, 'alta-1', payload, () => 'duplicate')
    ).toThrow();
    expect(record.discharges[0].deletedAt).toBeUndefined();
  });
  it('supports legacy cases without a snapshot and explicit corrections of date/time/diagnosis', () => {
    const record = setup();
    record.discharges[0].originalData = undefined;
    const result = convertDischargeToTransferRecord(
      record,
      'alta-1',
      { ...payload, movementDate: '2026-11-14', time: '23:00', diagnosis: 'Corregido' },
      () => 't'
    );
    expect(result.transfers[0]).toMatchObject({
      movementDate: '2026-11-14',
      time: '23:00',
      diagnosis: 'Corregido',
    });
    expect(result.transfers[0].originalData).toBeUndefined();
  });
  it('rejects deceased, missing/deleted cases and incomplete transfer details without mutation', () => {
    const record = setup();
    expect(() => convertDischargeToTransferRecord(record, 'missing', payload, () => 't')).toThrow();
    expect(() =>
      convertDischargeToTransferRecord(
        record,
        'alta-1',
        { ...payload, receivingCenterOther: '' },
        () => 't'
      )
    ).toThrow();
    record.discharges[0].status = 'Fallecido';
    expect(() => convertDischargeToTransferRecord(record, 'alta-1', payload, () => 't')).toThrow();
    expect(record.transfers).toEqual([]);
  });
});
