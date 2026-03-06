import { describe, expect, it } from 'vitest';

import { BEDS } from '@/constants';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import {
  buildActiveClinicalDocumentEpisodeKeys,
  buildBedEpisodeBindings,
  buildClinicalDocumentPresenceByBed,
} from '@/features/census/controllers/clinicalDocumentPresenceController';
import type { OccupiedBedRow } from '@/features/census/types/censusTableTypes';
import { DataFactory } from '@/tests/factories/DataFactory';

describe('clinicalDocumentPresenceController', () => {
  it('builds episode bindings only for main occupied rows with rut and admission date', () => {
    const occupiedRows: OccupiedBedRow[] = [
      {
        id: 'R1-main',
        bed: BEDS.find(bed => bed.id === 'R1')!,
        data: DataFactory.createMockPatient('R1', {
          patientName: 'Main',
          rut: '11.111.111-1',
          admissionDate: '2026-03-05',
        }),
        isSubRow: false,
      },
      {
        id: 'R1-crib',
        bed: BEDS.find(bed => bed.id === 'R1')!,
        data: DataFactory.createMockPatient('R1-crib', {
          patientName: 'Baby',
          rut: '22.222.222-2',
          admissionDate: '2026-03-05',
        }),
        isSubRow: true,
      },
      {
        id: 'R2-main',
        bed: BEDS.find(bed => bed.id === 'R2')!,
        data: DataFactory.createMockPatient('R2', {
          patientName: 'No rut',
          rut: '',
          admissionDate: '2026-03-05',
        }),
        isSubRow: false,
      },
    ];

    expect(buildBedEpisodeBindings(occupiedRows)).toEqual([
      {
        bedId: 'R1',
        episodeKey: '11.111.111-1__2026-03-05',
      },
    ]);
  });

  it('builds active episode set and presence map excluding archived documents', () => {
    const baseDocument: ClinicalDocumentRecord = {
      id: 'doc-base',
      hospitalId: 'h1',
      documentType: 'epicrisis',
      templateId: 'epicrisis',
      templateVersion: 1,
      title: 'Epicrisis',
      patientInfoTitle: 'Informacion del Paciente',
      footerMedicoLabel: 'Medico',
      footerEspecialidadLabel: 'Especialidad',
      patientRut: '11.111.111-1',
      patientName: 'Paciente',
      episodeKey: '11.111.111-1__2026-03-05',
      admissionDate: '2026-03-05',
      patientFields: [],
      sections: [],
      medico: 'Dr Test',
      especialidad: 'Medicina',
      status: 'draft',
      isLocked: false,
      isActiveEpisodeDocument: true,
      currentVersion: 1,
      versionHistory: [],
      audit: {
        createdAt: '2026-03-05T00:00:00.000Z',
        createdBy: {
          uid: 'u1',
          email: 'test@example.com',
          displayName: 'Test',
          role: 'admin',
        },
        updatedAt: '2026-03-05T00:00:00.000Z',
        updatedBy: {
          uid: 'u1',
          email: 'test@example.com',
          displayName: 'Test',
          role: 'admin',
        },
      },
    };

    const documents: ClinicalDocumentRecord[] = [
      {
        ...baseDocument,
        id: 'doc-1',
        episodeKey: '11.111.111-1__2026-03-05',
        status: 'signed',
      },
      {
        ...baseDocument,
        id: 'doc-2',
        patientRut: '22.222.222-2',
        episodeKey: '22.222.222-2__2026-03-05',
        status: 'archived',
      },
    ];

    const activeEpisodeKeys = buildActiveClinicalDocumentEpisodeKeys(documents);

    expect(
      buildClinicalDocumentPresenceByBed(
        [
          { bedId: 'R1', episodeKey: '11.111.111-1__2026-03-05' },
          { bedId: 'R2', episodeKey: '22.222.222-2__2026-03-05' },
        ],
        activeEpisodeKeys
      )
    ).toEqual({
      R1: true,
      R2: false,
    });
  });
});
