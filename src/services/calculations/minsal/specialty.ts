import { PatientData } from '@/types';
import { BEDS } from '@/constants';
import { normalizeSpecialty } from './normalization';

export function getPatientsBySpecialty(
  beds: Record<string, PatientData>
): Map<string, PatientData[]> {
  const bySpecialty = new Map<string, PatientData[]>();

  BEDS.forEach(bed => {
    const data = beds[bed.id];
    if (data && !data.isBlocked && data.patientName?.trim()) {
      const specialty = normalizeSpecialty(data.specialty);
      const existing = bySpecialty.get(specialty) || [];
      existing.push(data);
      bySpecialty.set(specialty, existing);

      // Also count nested crib patients
      if (data.clinicalCrib?.patientName?.trim()) {
        const cribSpecialty = normalizeSpecialty(data.clinicalCrib.specialty);
        const cribExisting = bySpecialty.get(cribSpecialty) || [];
        cribExisting.push(data.clinicalCrib);
        bySpecialty.set(cribSpecialty, cribExisting);
      }
    }
  });

  return bySpecialty;
}
