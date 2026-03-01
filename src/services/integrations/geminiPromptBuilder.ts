import { DailyRecord } from '@/types';

import { calculateStats } from '../calculations/statsCalculator';

export const getOccupiedShiftData = (record: DailyRecord) =>
  Object.values(record.beds)
    .filter(bed => bed.patientName || bed.isBlocked)
    .map(bed => ({
      bed: bed.bedId,
      status: bed.isBlocked ? 'BLOCKED' : 'OCCUPIED',
      diagnosis: bed.pathology,
      specialty: bed.specialty,
      condition: bed.status,
      age: bed.age,
      devices: bed.devices.join(', '),
      daysAdmitted: bed.admissionDate
        ? Math.floor(
            (new Date(record.date).getTime() - new Date(bed.admissionDate).getTime()) /
              (1000 * 3600 * 24)
          )
        : 0,
    }));

export const buildShiftReportPrompt = (record: DailyRecord): string => {
  const stats = calculateStats(record.beds);
  const occupiedData = getOccupiedShiftData(record);

  return `
    Actúa como una enfermera supervisora jefe experta en gestión clínica.
    Analiza los datos del turno del Hospital Hanga Roa para el día ${record.date}.
    
    Estadísticas Generales:
    - Total Pacientes: ${stats.totalHospitalized}
    - Camas Bloqueadas: ${stats.blockedBeds}
    - Disponibilidad: ${stats.serviceCapacity - stats.totalHospitalized - stats.blockedBeds} camas libres.

    Detalle de Pacientes (JSON simplificado):
    ${JSON.stringify(occupiedData)}

    Genera un reporte conciso en formato HTML (sin etiquetas markdown, solo tags html básicos como <p>, <ul>, <strong>) con las siguientes secciones:
    1. **Resumen de Ocupación**: Breve análisis de la carga del servicio.
    2. **Alertas Clínicas**: Destaca pacientes Graves o de cuidado, y aquellos con múltiples dispositivos invasivos.
    3. **Gestión de Camas**: Comentarios sobre camas bloqueadas o eficiencia del uso de recursos.
    4. **Recomendaciones**: Sugerencias breves para el siguiente turno.

    Mantén el tono profesional, clínico y directo.
  `;
};
