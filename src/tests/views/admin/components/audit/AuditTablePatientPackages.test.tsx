import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuditTable } from '@/features/admin/components/internal/audit/AuditTable';
import { buildClinicalAuditPatientPackages } from '@/services/admin/clinicalAuditPatientPackages';
import type { AuditLogEntry } from '@/types/auditLogTypes';

const statusLog: AuditLogEntry = {
  id: 'status-1',
  timestamp: '2026-07-01T19:36:29.000Z',
  userId: 'daniel.opazo@hospitalhangaroa.cl',
  userDisplayName: 'Daniel Opazo Damiani',
  userUid: 'uid-123',
  ipAddress: '148.227.67.162',
  action: 'PATIENT_MODIFIED',
  entityType: 'patient',
  entityId: 'H4C1',
  recordDate: '2026-07-01',
  patientIdentifier: '25DF52626',
  details: {
    patientName: 'Anastasio Hey Riroroko',
    rut: '25DF52626',
    bedId: 'H4C1',
    changes: { status: { old: '', new: 'Estable' } },
  },
};

const diagnosisLog: AuditLogEntry = {
  ...statusLog,
  id: 'diagnosis-1',
  timestamp: '2026-07-01T19:36:54.000Z',
  action: 'PATIENT_DIAGNOSIS_CHANGED',
  details: {
    patientName: 'Anastasio Hey Riroroko',
    rut: '25DF52626',
    bedId: 'H4C1',
    changes: { diagnosis: { old: '', new: 'ICC' } },
  },
};

const patientPackages = buildClinicalAuditPatientPackages([statusLog, diagnosisLog]);

const baseProps = {
  filteredLogs: [statusLog, diagnosisLog],
  displayLogsCount: 2,
  paginatedLogs: [statusLog, diagnosisLog],
  patientPackages,
  paginatedPatientPackages: patientPackages,
  loading: false,
  compactView: false,
  setCompactView: vi.fn(),
  groupedView: true,
  setGroupedView: vi.fn(),
  expandedRows: new Set<string>(),
  toggleRow: vi.fn(),
  onPdfExport: vi.fn(),
  onExcelExport: vi.fn(),
  isExporting: false,
  fetchLimit: 500,
  canLoadMoreLogs: false,
  onLoadMoreLogs: vi.fn(),
  currentPage: 1,
  totalPages: 1,
  onPageChange: vi.fn(),
  itemsPerPage: 50,
};

describe('AuditTable patient-centered packages', () => {
  it('renders compact patient packages when grouped view is enabled', () => {
    const toggleRow = vi.fn();
    render(<AuditTable {...baseProps} toggleRow={toggleRow} />);

    expect(screen.getByText(/paquetes por paciente/i)).toBeInTheDocument();
    expect(screen.getAllByText('Anastasio Hey Riroroko')).toHaveLength(1);
    expect(screen.getByText('Estable')).toBeInTheDocument();
    expect(screen.getByText('ICC')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Anastasio Hey Riroroko'));

    expect(toggleRow).toHaveBeenCalledWith(patientPackages[0].id);
  });

  it('keeps the raw event table when grouped view is disabled', () => {
    render(<AuditTable {...baseProps} groupedView={false} />);

    expect(screen.getByText('Evento clínico')).toBeInTheDocument();
    expect(screen.getByText('Diagnóstico actualizado')).toBeInTheDocument();
  });

  it('offers a bounded load-more action when the current audit window may be incomplete', () => {
    const onLoadMoreLogs = vi.fn();
    render(<AuditTable {...baseProps} canLoadMoreLogs onLoadMoreLogs={onLoadMoreLogs} />);

    fireEvent.click(screen.getByRole('button', { name: /cargar m[aá]s/i }));

    expect(onLoadMoreLogs).toHaveBeenCalledTimes(1);
  });
});
