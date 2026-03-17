/** @vitest-environment jsdom */
import '../../setup';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MedicalSpecialtyHandoffSection } from '@/features/handoff/components/MedicalSpecialtyHandoffSection';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const buildRecord = (overrides: Partial<DailyRecord> = {}): DailyRecord =>
  ({
    date: '2026-03-16',
    beds: {},
    activeExtraBeds: [],
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: '2026-03-16T09:00:00.000Z',
    medicalHandoffNovedades: '',
    medicalHandoffBySpecialty: {
      cirugia: {
        note: 'Paciente estable, sin cambios mayores.',
        createdAt: '2026-03-14T08:00:00.000Z',
        updatedAt: '2026-03-14T08:00:00.000Z',
        author: {
          uid: 'doctor-1',
          displayName: 'Dra. Cirugía',
          email: 'cirugia@test.cl',
          specialty: 'cirugia',
        },
        version: 1,
      },
    },
    ...overrides,
  }) as DailyRecord;

describe('MedicalSpecialtyHandoffSection', () => {
  it('renders specialty continuity workflow with shared status copy', () => {
    const onConfirmMedicalSpecialtyNoChanges = vi.fn().mockResolvedValue(undefined);

    render(
      <MedicalSpecialtyHandoffSection
        record={buildRecord()}
        readOnly={false}
        role="nurse_hospital"
        user={null}
        editableSpecialties={[]}
        onUpdateMedicalSpecialtyNote={vi.fn().mockResolvedValue(undefined)}
        onConfirmMedicalSpecialtyNoChanges={onConfirmMedicalSpecialtyNoChanges}
      />
    );

    expect(screen.getByText('Entrega médica por especialidad')).toBeInTheDocument();
    expect(screen.getAllByText('Cirugía').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0);
    expect(
      screen.getByText(/Condición actual sin cambios respecto a última entrega/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Confirmar sin cambios hoy/i }));

    expect(onConfirmMedicalSpecialtyNoChanges).toHaveBeenCalledWith(
      expect.objectContaining({
        specialty: 'cirugia',
        dateKey: '2026-03-16',
      })
    );
  });

  it('shows legacy summary when there is no structured specialty data', () => {
    render(
      <MedicalSpecialtyHandoffSection
        record={buildRecord({
          medicalHandoffBySpecialty: {},
          medicalHandoffNovedades: 'Resumen legado de continuidad médica.',
        })}
        readOnly={true}
        role="doctor_specialist"
        user={null}
        editableSpecialties={[]}
        onUpdateMedicalSpecialtyNote={vi.fn().mockResolvedValue(undefined)}
        onConfirmMedicalSpecialtyNoChanges={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText('Resumen legado')).toBeInTheDocument();
    expect(screen.getByText('Resumen legado de continuidad médica.')).toBeInTheDocument();
    expect(screen.getByText('Solo lectura para este registro.')).toBeInTheDocument();
  });
});
