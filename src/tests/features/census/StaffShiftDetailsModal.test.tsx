import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StaffShiftDetailsModal } from '@/features/census/components/StaffShiftDetailsModal';
import type { DailyRecordStaffingDetailsV1 } from '@/types/domain/dailyRecordStaffingDetails';

const buildDetail = (): DailyRecordStaffingDetailsV1 => ({
  day: {
    nurses: [
      {
        id: 'nurse-day-1',
        name: 'Enfermera Claudia',
        role: 'nurse',
        slotType: 'standard',
        standardSlotIndex: 0,
        startTime: '08:00',
        endTime: '20:00',
      },
    ],
    tens: [
      {
        id: 'tens-day-1',
        name: 'Tens Paula',
        role: 'tens',
        slotType: 'standard',
        standardSlotIndex: 0,
        startTime: '08:00',
        endTime: '20:00',
      },
    ],
  },
  night: {
    nurses: [
      {
        id: 'nurse-night-1',
        name: 'Enfermera Noche',
        role: 'nurse',
        slotType: 'standard',
        standardSlotIndex: 0,
        startTime: '20:00',
        endTime: '08:00',
      },
    ],
    tens: [
      {
        id: 'tens-night-1',
        name: 'Tens Noche',
        role: 'tens',
        slotType: 'standard',
        standardSlotIndex: 0,
        startTime: '20:00',
        endTime: '08:00',
      },
    ],
  },
});

describe('StaffShiftDetailsModal', () => {
  it('shows one role at a time and switches shift configuration with tabs', () => {
    render(
      <StaffShiftDetailsModal
        isOpen={true}
        onClose={vi.fn()}
        role="nurse"
        initialShift="day"
        recordDate="2026-02-17"
        detail={buildDetail()}
        nursesList={['Enfermera Claudia']}
        tensList={['Tens Paula']}
        onSave={vi.fn()}
      />
    );

    expect(screen.getByText('Configuración detallada Enfermería')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Turno Largo' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(/08:00 - 20:00/)).toBeInTheDocument();
    expect(screen.getByText('Enfermería')).toBeInTheDocument();
    expect(screen.queryByText('TENS')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'Turno Noche' }));

    expect(screen.getByRole('tab', { name: 'Turno Noche' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByText(/20:00 - 08:00/)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Enfermera Noche')).toBeInTheDocument();
  });
});
