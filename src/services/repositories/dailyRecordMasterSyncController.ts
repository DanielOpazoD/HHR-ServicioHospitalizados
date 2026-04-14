export const buildPatientMasterSeed = (input: {
  rut: string;
  fullName: string;
  birthDate?: string | null;
  forecast?: string | null;
  gender?: string | null;
}) => ({
  rut: input.rut,
  fullName: input.fullName,
  birthDate: input.birthDate ?? undefined,
  forecast: input.forecast ?? undefined,
  gender: input.gender ?? undefined,
});

export const buildIngresoRealtimeEvent = (input: {
  date: string;
  diagnosis?: string | null;
  bedName?: string | null;
}) => ({
  id: `${input.date}-ingreso-rt`,
  type: 'Ingreso' as const,
  date: input.date,
  diagnosis: input.diagnosis || 'S/D',
  bedName: input.bedName ?? undefined,
});

export const buildEgresoRealtimeEvent = (input: {
  date: string;
  diagnosis?: string | null;
  bedName?: string | null;
}) => ({
  id: `${input.date}-egreso-rt`,
  type: 'Egreso' as const,
  date: input.date,
  diagnosis: input.diagnosis || 'S/D',
  bedName: input.bedName ?? undefined,
});

export const buildTrasladoRealtimeEvent = (input: {
  date: string;
  diagnosis?: string | null;
  bedName?: string | null;
  receivingCenter?: string | null;
}) => ({
  id: `${input.date}-traslado-rt`,
  type: 'Traslado' as const,
  date: input.date,
  diagnosis: input.diagnosis || 'S/D',
  bedName: input.bedName ?? undefined,
  receivingCenter: input.receivingCenter ?? undefined,
});

export const buildDischargePatientMasterPatch = (input: {
  date: string;
  status?: string | null;
}) => ({
  lastDischarge: input.date,
  ...(input.status === 'Fallecido' ? { vitalStatus: 'Fallecido' as const } : {}),
});

export const buildAdmissionPatientMasterPatch = (date?: string | null) =>
  date ? { lastAdmission: date } : {};
