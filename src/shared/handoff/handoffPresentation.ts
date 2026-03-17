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
