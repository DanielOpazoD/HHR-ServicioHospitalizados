export interface HospitalizationEvent {
  id: string;
  type: 'Ingreso' | 'Egreso' | 'Traslado' | 'Fallecimiento';
  date: string;
  diagnosis: string;
  bedName?: string;
  receivingCenter?: string;
  isEvacuation?: boolean;
}

export interface MasterPatient {
  rut: string;
  fullName: string;
  birthDate?: string;
  commune?: string;
  address?: string;
  phone?: string;
  forecast?: string;
  gender?: string;
  lastAdmission?: string;
  lastDischarge?: string;
  hospitalizations?: HospitalizationEvent[];
  vitalStatus?: 'Vivo' | 'Fallecido';
  createdAt: number;
  updatedAt: number;
}
