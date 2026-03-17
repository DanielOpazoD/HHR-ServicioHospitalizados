import { formatCensusIsoDate } from '@/shared/census/censusPresentation';

export const formatHandoffDateTime = (isoTimestamp?: string | null): string => {
  if (!isoTimestamp) {
    return 'sin registro';
  }

  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) {
    return 'sin registro';
  }

  return parsed.toLocaleString('es-CL');
};

export const formatHandoffDate = (isoDate?: string | null): string => {
  if (!isoDate) {
    return 'Sin fecha';
  }

  return formatCensusIsoDate(isoDate);
};

export const formatHandoffVerboseDate = (isoDate?: string | null): string => {
  if (!isoDate) {
    return 'Sin fecha';
  }

  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }

  return parsed.toLocaleDateString('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const resolveHandoffDocumentDate = (recordDate?: string): string | null => {
  if (!recordDate) {
    return null;
  }

  const formatted = formatHandoffDate(recordDate);
  return formatted === recordDate ? null : formatted;
};

export const resolveHandoffDocumentTitleLabel = ({
  isMedical,
  selectedShift,
  recordDate,
}: {
  isMedical: boolean;
  selectedShift: 'day' | 'night';
  recordDate?: string;
}): string | null => {
  const formattedDate = resolveHandoffDocumentDate(recordDate);
  if (!formattedDate) {
    return null;
  }

  if (isMedical) {
    return `Entrega Medico ${formattedDate}`;
  }

  return `${selectedShift === 'day' ? 'TL' : 'TN'} ${formattedDate}`;
};

export const getMedicalSpecialtyStatusLabel = (
  status: 'updated_by_specialist' | 'confirmed_no_changes' | 'pending'
): string => {
  switch (status) {
    case 'updated_by_specialist':
      return 'Actualizado por especialista hoy';
    case 'confirmed_no_changes':
      return 'Confirmado sin cambios';
    default:
      return 'Pendiente';
  }
};

export const getMedicalSpecialtyContinuityHint = (
  status: 'updated_by_specialist' | 'confirmed_no_changes' | 'pending'
): string => {
  switch (status) {
    case 'updated_by_specialist':
      return 'La especialidad ya fue actualizada hoy por un especialista.';
    case 'confirmed_no_changes':
      return 'La continuidad diaria ya fue confirmada hoy.';
    default:
      return 'Pendiente de actualización o confirmación diaria.';
  }
};
