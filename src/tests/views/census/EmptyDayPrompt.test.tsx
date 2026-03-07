import React from 'react';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmptyDayPrompt } from '@/features/census/components/EmptyDayPrompt';

describe('EmptyDayPrompt', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('disables copy button and shows countdown before 08:00 for today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 3, 7, 30, 0));

    render(
      <EmptyDayPrompt
        selectedDay={3}
        selectedMonth={2}
        currentDateString="2026-03-03"
        previousRecordAvailable={true}
        previousRecordDate="2026-03-02"
        availableDates={['2026-03-02', '2026-03-01']}
        onCreateDay={() => undefined}
      />
    );

    expect(screen.getByTestId('copy-previous-btn')).toBeDisabled();
    expect(screen.getByText('Disponible hoy desde las 8:00 hrs.')).toBeInTheDocument();
    expect(screen.getByText('Se habilita en 00:30:00')).toBeInTheDocument();
  });

  it('keeps copy button enabled for days that are not today', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 3, 7, 30, 0));

    render(
      <EmptyDayPrompt
        selectedDay={2}
        selectedMonth={2}
        currentDateString="2026-03-02"
        previousRecordAvailable={true}
        previousRecordDate="2026-03-01"
        availableDates={['2026-03-01']}
        onCreateDay={() => undefined}
      />
    );

    expect(screen.getByTestId('copy-previous-btn')).not.toBeDisabled();
    expect(screen.queryByText(/Se habilita en/)).not.toBeInTheDocument();
  });

  it('keeps tomorrow locked with a 24-hour countdown after today starts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 3, 8, 0, 0));

    render(
      <EmptyDayPrompt
        selectedDay={4}
        selectedMonth={2}
        currentDateString="2026-03-04"
        previousRecordAvailable={true}
        previousRecordDate="2026-03-03"
        availableDates={['2026-03-03']}
        onCreateDay={() => undefined}
      />
    );

    expect(screen.getByTestId('copy-previous-btn')).toBeDisabled();
    expect(screen.getByText('Disponible desde el 4 de Marzo a las 8:00 hrs.')).toBeInTheDocument();
    expect(screen.getByText('Se habilita en 24:00:00')).toBeInTheDocument();
  });
});
