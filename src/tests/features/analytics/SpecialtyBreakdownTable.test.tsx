import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { SpecialtyBreakdownTable } from '@/features/analytics/components/internal/SpecialtyBreakdownTable';
import type { MinsalStatistics } from '@/types/minsalTypes';

const summary: MinsalStatistics = {
  periodStart: '2026-03-01',
  periodEnd: '2026-03-31',
  totalDays: 31,
  calendarDays: 31,
  diasCamaDisponibles: 558,
  diasCamaOcupados: 390,
  tasaOcupacion: 69.9,
  promedioDiasEstada: 4.2,
  promedioDiasEstadaMinima: 1,
  promedioDiasEstadaMaxima: 8,
  egresosTotal: 40,
  egresosVivos: 36,
  egresosFallecidos: 2,
  egresosTraslados: 2,
  mortalidadHospitalaria: 5,
  indiceRotacion: 2.1,
  pacientesActuales: 13,
  camasOcupadas: 13,
  camasBloqueadas: 0,
  camasDisponibles: 18,
  camasLibres: 5,
  tasaOcupacionActual: 72.2,
  porEspecialidad: [],
};

describe('SpecialtyBreakdownTable', () => {
  it('labels the first metric as period bed-days instead of current patients', () => {
    render(<SpecialtyBreakdownTable data={[]} records={[]} summary={summary} />);

    expect(
      screen.getByText('No hay datos de especialidades para el período seleccionado.')
    ).toBeInTheDocument();
  });

  it('uses explicit period wording in the specialty header row', () => {
    render(
      <SpecialtyBreakdownTable
        data={[
          {
            specialty: 'Medicina',
            pacientesActuales: 3,
            egresos: 2,
            fallecidos: 1,
            traslados: 0,
            aerocardal: 0,
            fach: 0,
            diasOcupados: 9,
            contribucionRelativa: 50,
            tasaMortalidad: 50,
            promedioDiasEstada: 4.5,
            promedioDiasEstadaMinima: 2,
            promedioDiasEstadaMaxima: 6,
            diasOcupadosList: [],
            egresosList: [],
            trasladosList: [],
            aerocardalList: [],
            fachList: [],
            fallecidosList: [],
          },
        ]}
        records={[]}
        summary={summary}
      />
    );

    expect(screen.getByText('Días-cama del período')).toBeInTheDocument();
    expect(screen.queryByText('Pacientes (Días-Cama del período)')).not.toBeInTheDocument();
    expect(screen.getByText('Estada media de egresos')).toBeInTheDocument();
    expect(screen.getByText('Rango estada egresos')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('shows diagnosis in the traceability dialog for period event details', () => {
    render(
      <SpecialtyBreakdownTable
        data={[
          {
            specialty: 'Medicina',
            pacientesActuales: 3,
            egresos: 1,
            fallecidos: 0,
            traslados: 0,
            aerocardal: 0,
            fach: 0,
            diasOcupados: 9,
            contribucionRelativa: 50,
            tasaMortalidad: 0,
            promedioDiasEstada: 4.5,
            promedioDiasEstadaMinima: 2,
            promedioDiasEstadaMaxima: 6,
            diasOcupadosList: [],
            egresosList: [
              {
                name: 'Paciente Demo',
                rut: '11.111.111-1',
                diagnosis: 'Neumonía adquirida en la comunidad',
                date: '2026-03-01',
                bedName: 'UTI 1',
              },
            ],
            trasladosList: [],
            aerocardalList: [],
            fachList: [],
            fallecidosList: [],
          },
        ]}
        records={[]}
        summary={summary}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '1' }));

    expect(screen.getByText('Diagnóstico')).toBeInTheDocument();
    expect(screen.getByText('Neumonía adquirida en la comunidad')).toBeInTheDocument();
    expect(screen.getByText('100.0%')).toBeInTheDocument();
  });

  it('opens the stay range modal with admission and discharge dates', () => {
    const onOpenCensusDate = vi.fn();

    render(
      <SpecialtyBreakdownTable
        data={[
          {
            specialty: 'Cirugía',
            pacientesActuales: 2,
            egresos: 1,
            fallecidos: 0,
            traslados: 0,
            aerocardal: 0,
            fach: 0,
            diasOcupados: 10,
            contribucionRelativa: 50,
            tasaMortalidad: 0,
            promedioDiasEstada: 3,
            promedioDiasEstadaMinima: 3,
            promedioDiasEstadaMaxima: 3,
            diasOcupadosList: [],
            egresosList: [
              {
                name: 'Paciente Rango',
                rut: '22.222.222-2',
                diagnosis: 'Apendicitis',
                date: '2026-01-26',
                bedName: 'Cama 1',
                admissionDate: '2026-01-23',
                dischargeDate: '2026-01-26',
              },
            ],
            trasladosList: [],
            aerocardalList: [],
            fachList: [],
            fallecidosList: [],
          },
        ]}
        records={[]}
        summary={summary}
        onOpenCensusDate={onOpenCensusDate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Ver casos de estada de Cirugía/ }));

    expect(screen.getByText('Detalle: Estada de egresos - Cirugía')).toBeInTheDocument();
    expect(screen.getByText('Ingreso')).toBeInTheDocument();
    expect(screen.getByText('Egreso')).toBeInTheDocument();
    expect(screen.getByText('Días estada')).toBeInTheDocument();
    expect(screen.getByText('23-01-2026')).toBeInTheDocument();
    expect(screen.getByText('26-01-2026')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Mínimo')).toBeInTheDocument();
    expect(screen.getByText('Máximo')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir censo' }));

    expect(onOpenCensusDate).toHaveBeenCalledWith('2026-01-23');
  });

  it('falls back to resolved discharge stays when summary is not provided', () => {
    render(
      <SpecialtyBreakdownTable
        data={[
          {
            specialty: 'Cirugía',
            pacientesActuales: 0,
            egresos: 1,
            fallecidos: 0,
            traslados: 0,
            aerocardal: 0,
            fach: 0,
            diasOcupados: 4,
            contribucionRelativa: 100,
            tasaMortalidad: 0,
            promedioDiasEstada: 4,
            promedioDiasEstadaMinima: 4,
            promedioDiasEstadaMaxima: 4,
            diasOcupadosList: [],
            egresosList: [
              {
                name: 'Paciente DEIS',
                rut: '11.111.111-1',
                diagnosis: 'Diagnóstico',
                date: '2026-03-05',
                bedName: 'Cama 1',
                admissionDate: '2026-03-01',
                dischargeDate: '2026-03-05',
              },
            ],
            trasladosList: [],
            aerocardalList: [],
            fachList: [],
            fallecidosList: [],
          },
        ]}
        records={[]}
      />
    );

    expect(screen.getAllByText('4.00 días')).toHaveLength(2);
  });
});
