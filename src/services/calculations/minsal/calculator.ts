import { DailyRecord } from '@/types/domain/dailyRecord';
import { Specialty } from '@/types/domain/base';
import { HOSPITAL_CAPACITY } from '@/constants/beds';
import { EVACUATION_METHOD_AEROCARDAL } from '@/constants/clinical';
import { MinsalStatistics, SpecialtyStats, PatientTraceability } from '@/types/minsalTypes';
import { normalizeSpecialty, isFachEvacuationMethod } from './normalization';
import { countOccupiedBeds, countBlockedBeds, calculateDailySnapshot } from './snapshot';
import { getPatientsBySpecialty } from './specialty';

/**
 * Filter records by date range
 */
export function filterRecordsByDateRange(
  records: DailyRecord[],
  startDate: string,
  endDate: string
): DailyRecord[] {
  return records.filter(r => r.date >= startDate && r.date <= endDate);
}

/**
 * Main MINSAL statistics calculator
 */
export function calculateMinsalStats(
  records: DailyRecord[],
  startDate: string,
  endDate: string
): MinsalStatistics {
  // Filter records in range
  const filteredRecords = filterRecordsByDateRange(records, startDate, endDate);

  // Calculate period days
  const start = new Date(startDate);
  const end = new Date(endDate);
  const calendarDays = Math.max(
    1,
    Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const totalDays = filteredRecords.length;

  // Aggregate statistics
  let totalDiasCamaDisponibles = 0;
  let totalDiasCamaOcupados = 0;
  let totalEgresosVivos = 0;
  let totalEgresosFallecidos = 0;
  let totalEgresosTraslados = 0;

  type SpecialtyBucket = {
    pacientes: number;
    egresos: number;
    fallecidos: number;
    traslados: number;
    aerocardal: number;
    fach: number;
    diasOcupados: number;
    diasOcupadosList: PatientTraceability[];
    egresosList: PatientTraceability[];
    trasladosList: PatientTraceability[];
    aerocardalList: PatientTraceability[];
    fachList: PatientTraceability[];
    fallecidosList: PatientTraceability[];
  };

  const createSpecialtyBucket = (): SpecialtyBucket => ({
    pacientes: 0,
    egresos: 0,
    fallecidos: 0,
    traslados: 0,
    aerocardal: 0,
    fach: 0,
    diasOcupados: 0,
    diasOcupadosList: [],
    egresosList: [],
    trasladosList: [],
    aerocardalList: [],
    fachList: [],
    fallecidosList: [],
  });

  const specialtyData = new Map<string, SpecialtyBucket>();

  // Pre-calculate discharge/transfer dates
  const dischargeDates = new Map<string, string>();
  filteredRecords.forEach(r => {
    r.discharges?.forEach(d => dischargeDates.set(d.rut, r.date));
    r.transfers?.forEach(t => dischargeDates.set(t.rut, r.date));
  });

  filteredRecords.forEach(record => {
    const bloqueadas = countBlockedBeds(record.beds);
    const disponibles = HOSPITAL_CAPACITY - bloqueadas;
    const ocupadas = countOccupiedBeds(record.beds);

    totalDiasCamaDisponibles += disponibles;
    totalDiasCamaOcupados += ocupadas;

    record.discharges?.forEach(d => {
      if (d.status === 'Fallecido') totalEgresosFallecidos++;
      else totalEgresosVivos++;
    });

    totalEgresosTraslados += record.transfers?.length || 0;

    const patientsBySpecialty = getPatientsBySpecialty(record.beds);
    patientsBySpecialty.forEach((patients, specialty) => {
      const existing = specialtyData.get(specialty) || createSpecialtyBucket();
      existing.diasOcupados += patients.length;

      patients.forEach(p => {
        existing.diasOcupadosList.push({
          name: p.patientName,
          rut: p.rut,
          date: record.date,
          bedName: p.bedName,
          admissionDate: p.admissionDate,
          dischargeDate: dischargeDates.get(p.rut),
        });
      });
      specialtyData.set(specialty, existing);
    });

    record.discharges?.forEach(d => {
      const specialty = normalizeSpecialty(d.originalData?.specialty);
      const existing = specialtyData.get(specialty) || createSpecialtyBucket();
      existing.egresos++;

      const traceData = {
        name: d.patientName,
        rut: d.rut,
        date: record.date,
        bedName: d.bedName,
      };

      existing.egresosList.push(traceData);
      if (d.status === 'Fallecido') {
        existing.fallecidos++;
        existing.fallecidosList.push(traceData);
      }
      specialtyData.set(specialty, existing);
    });

    record.transfers?.forEach(t => {
      const specialty = normalizeSpecialty(t.originalData?.specialty);
      const existing = specialtyData.get(specialty) || createSpecialtyBucket();
      existing.traslados++;

      const traceData = {
        name: t.patientName,
        rut: t.rut,
        date: record.date,
        bedName: t.bedName,
      };

      existing.egresosList.push(traceData);
      existing.trasladosList.push(traceData);
      if (t.evacuationMethod === EVACUATION_METHOD_AEROCARDAL) {
        existing.aerocardal++;
        existing.aerocardalList.push(traceData);
      }
      if (isFachEvacuationMethod(t.evacuationMethod)) {
        existing.fach++;
        existing.fachList.push(traceData);
      }
      specialtyData.set(specialty, existing);
    });
  });

  const egresosTotal = totalEgresosVivos + totalEgresosFallecidos + totalEgresosTraslados;
  const tasaOcupacion =
    totalDiasCamaDisponibles > 0 ? (totalDiasCamaOcupados / totalDiasCamaDisponibles) * 100 : 0;
  const promedioDiasEstada = egresosTotal > 0 ? totalDiasCamaOcupados / egresosTotal : 0;
  const mortalidadHospitalaria =
    egresosTotal > 0 ? (totalEgresosFallecidos / egresosTotal) * 100 : 0;

  const avgAvailableBeds = totalDays > 0 ? totalDiasCamaDisponibles / totalDays : 0;
  const indiceRotacion =
    avgAvailableBeds > 0 && totalDays > 0
      ? (egresosTotal / avgAvailableBeds) * (30 / totalDays)
      : 0;

  const recordsWithData = filteredRecords.filter(r => countOccupiedBeds(r.beds) > 0);
  const latestRecord = (recordsWithData.length > 0 ? recordsWithData : filteredRecords).sort(
    (a, b) => b.date.localeCompare(a.date)
  )[0];

  const currentSnapshot = latestRecord
    ? calculateDailySnapshot(latestRecord)
    : { ocupadas: 0, disponibles: HOSPITAL_CAPACITY, bloqueadas: 0, tasaOcupacion: 0 };

  const totalPacientes = Array.from(specialtyData.values()).reduce(
    (sum, s) => sum + s.diasOcupados,
    0
  );

  const porEspecialidad: SpecialtyStats[] = Array.from(specialtyData.entries())
    .map(([specialty, data]) => {
      const egresosEspecialidad = data.egresos || 1;
      return {
        specialty: specialty as Specialty,
        pacientesActuales: latestRecord
          ? getPatientsBySpecialty(latestRecord.beds).get(specialty)?.length || 0
          : 0,
        egresos: data.egresos,
        fallecidos: data.fallecidos,
        diasOcupados: data.diasOcupados,
        contribucionRelativa: totalPacientes > 0 ? (data.diasOcupados / totalPacientes) * 100 : 0,
        tasaMortalidad: egresosEspecialidad > 0 ? (data.fallecidos / egresosEspecialidad) * 100 : 0,
        traslados: data.traslados || 0,
        aerocardal: data.aerocardal || 0,
        fach: data.fach || 0,
        promedioDiasEstada: data.egresos > 0 ? data.diasOcupados / data.egresos : 0,
        diasOcupadosList: data.diasOcupadosList,
        egresosList: data.egresosList,
        trasladosList: data.trasladosList,
        aerocardalList: data.aerocardalList,
        fachList: data.fachList,
        fallecidosList: data.fallecidosList,
      };
    })
    .sort((a, b) => b.contribucionRelativa - a.contribucionRelativa);

  return {
    periodStart: startDate,
    periodEnd: endDate,
    totalDays,
    calendarDays,
    diasCamaDisponibles: totalDiasCamaDisponibles,
    diasCamaOcupados: totalDiasCamaOcupados,
    tasaOcupacion: Math.round(tasaOcupacion * 10) / 10,
    promedioDiasEstada: Math.round(promedioDiasEstada * 10) / 10,
    egresosTotal,
    egresosVivos: totalEgresosVivos,
    egresosFallecidos: totalEgresosFallecidos,
    egresosTraslados: totalEgresosTraslados,
    mortalidadHospitalaria: Math.round(mortalidadHospitalaria * 10) / 10,
    indiceRotacion: Math.round(indiceRotacion * 10) / 10,
    pacientesActuales: currentSnapshot.ocupadas,
    camasOcupadas: currentSnapshot.ocupadas,
    camasBloqueadas: currentSnapshot.bloqueadas,
    camasDisponibles: currentSnapshot.disponibles,
    camasLibres: Math.max(0, currentSnapshot.disponibles - currentSnapshot.ocupadas),
    tasaOcupacionActual: currentSnapshot.tasaOcupacion,
    porEspecialidad,
  };
}
