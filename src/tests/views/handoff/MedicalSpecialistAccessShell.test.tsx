/** @vitest-environment jsdom */
import '../../setup';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';

import { MedicalSpecialistAccessShell } from '@/features/handoff/components/MedicalSpecialistAccessShell';
import { render, createMockDailyRecordContext, createMockRecord } from '../../integration/setup';

describe('MedicalSpecialistAccessShell', () => {
  it('renders the restricted specialist shell with logout only', () => {
    const record = createMockRecord('2026-03-14');
    const dailyRecordHook = createMockDailyRecordContext(record);

    render(
      <MedicalSpecialistAccessShell
        dailyRecordHook={dailyRecordHook}
        medicalScope="upc"
        specialty="Cirugía"
      />
    );

    expect(screen.getByText('Acceso restringido especialista')).toBeInTheDocument();
    expect(screen.getByText('Entrega de Turno Médicos')).toBeInTheDocument();
    expect(screen.getByText(/Alcance: UPC · Cirugía/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Cerrar sesión/i })).toBeInTheDocument();
    expect(screen.queryByText(/Censo Diario/i)).not.toBeInTheDocument();
  });
});
