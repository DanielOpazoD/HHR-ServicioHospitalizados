import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DemographicsCard } from '@/features/census/components/global-search/DemographicsCard';
import type { MasterPatient } from '@/types/domain/patientMaster';

const patient: MasterPatient = {
  rut: '18.781.542-8',
  fullName: 'Tipanie Carossi Pakomio',
  birthDate: '1994-03-09',
  gender: 'Femenino',
  forecast: 'Fonasa',
  commune: 'Rapa Nui',
  createdAt: 1,
  updatedAt: 1,
};

describe('DemographicsCard', () => {
  it('keeps the search detail header focused on identity and hides secondary demographics', () => {
    render(<DemographicsCard patient={patient} />);

    expect(screen.getByText('Tipanie Carossi Pakomio')).toBeInTheDocument();
    expect(screen.getByText('18.781.542-8')).toBeInTheDocument();
    expect(screen.queryByText('Nacimiento')).not.toBeInTheDocument();
    expect(screen.queryByText('Sexo')).not.toBeInTheDocument();
    expect(screen.queryByText('Prevision')).not.toBeInTheDocument();
    expect(screen.queryByText('09-03-1994')).not.toBeInTheDocument();
    expect(screen.queryByText('Femenino')).not.toBeInTheDocument();
    expect(screen.queryByText('Fonasa')).not.toBeInTheDocument();
  });
});
