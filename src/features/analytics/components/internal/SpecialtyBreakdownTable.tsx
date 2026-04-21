/**
 * SpecialtyBreakdownTable Component
 * Table showing statistics breakdown by medical specialty
 */

import React from 'react';
import { MinsalStatistics, SpecialtyStats } from '@/types/minsalTypes';
import { DailyRecord } from '@/features/analytics/contracts/analyticsDailyRecordContracts';
import {
  buildSpecialtyTraceability,
  SpecialtyTraceabilityType,
} from '@/services/calculations/minsalStatsCalculator';
import { calculateDischargeStayDays } from '@/utils/clinicalDayUtils';
import { TraceabilityModal } from './TraceabilityModal';

interface SpecialtyBreakdownTableProps {
  data: SpecialtyStats[];
  records?: DailyRecord[];
  summary?: MinsalStatistics;
  onOpenCensusDate?: (date: string) => void;
}

const formatRange = (min?: number, max?: number): string =>
  min !== undefined && max !== undefined ? `${min.toFixed(1)} - ${max.toFixed(1)} días` : '—';

const getStayDays = (
  patient: import('@/types/minsalTypes').PatientTraceability | undefined
): number | null => calculateDischargeStayDays(patient?.admissionDate, patient?.dischargeDate);

const calculateStayAverageFromTraceability = (rows: SpecialtyStats[]): number => {
  const stayDays = rows.flatMap(row =>
    (row.egresosList ?? []).map(getStayDays).filter((value): value is number => value !== null)
  );

  if (stayDays.length === 0) {
    return 0;
  }

  const totalStayDays = stayDays.reduce((sum, value) => sum + value, 0);
  return totalStayDays / stayDays.length;
};

export const SpecialtyBreakdownTable: React.FC<SpecialtyBreakdownTableProps> = ({
  data = [],
  records = [],
  summary,
  onOpenCensusDate,
}) => {
  const [modalConfig, setModalConfig] = React.useState<{
    isOpen: boolean;
    title: string;
    patients: import('@/types/minsalTypes').PatientTraceability[];
    type: SpecialtyTraceabilityType;
  }>({
    isOpen: false,
    title: '',
    patients: [],
    type: 'dias-cama',
  });

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        No hay datos de especialidades para el período seleccionado.
      </div>
    );
  }

  const handleOpenTraceability = (
    specialty: string,
    type: SpecialtyTraceabilityType,
    patients: import('@/types/minsalTypes').PatientTraceability[] = []
  ) => {
    const resolvedPatients =
      patients.length > 0 ? patients : buildSpecialtyTraceability(records, specialty, type);

    let titleType = '';
    switch (type) {
      case 'dias-cama':
        titleType = 'Días Cama';
        break;
      case 'egresos':
        titleType = 'Egresos';
        break;
      case 'fallecidos':
        titleType = 'Fallecidos';
        break;
      case 'traslados':
        titleType = 'Traslados';
        break;
      case 'aerocardal':
        titleType = 'Aerocardal';
        break;
      case 'fach':
        titleType = 'FACH';
        break;
      case 'estada':
        titleType = 'Estada de egresos';
        break;
    }

    setModalConfig({
      isOpen: true,
      title: `Detalle: ${titleType} - ${specialty}`,
      patients: resolvedPatients,
      type,
    });
  };

  const totalEgresos = data.reduce((sum, row) => sum + (row.egresos ?? 0), 0);
  const totalFallecidos = data.reduce((sum, row) => sum + (row.fallecidos ?? 0), 0);
  const totalTraslados = data.reduce((sum, row) => sum + (row.traslados ?? 0), 0);
  const totalAerocardal = data.reduce((sum, row) => sum + (row.aerocardal ?? 0), 0);
  const totalFach = data.reduce((sum, row) => sum + (row.fach ?? 0), 0);
  const totalPacientesActuales =
    summary?.pacientesActuales ?? data.reduce((sum, row) => sum + (row.pacientesActuales ?? 0), 0);
  const totalEgresosConTraslados = totalEgresos + totalTraslados;
  const totalPromedioDiasEstada =
    summary?.promedioDiasEstada ?? calculateStayAverageFromTraceability(data);
  const totalMortalidad =
    summary?.mortalidadHospitalaria ??
    (totalEgresosConTraslados > 0 ? (totalFallecidos / totalEgresosConTraslados) * 100 : 0);
  const totalRange = formatRange(
    summary?.promedioDiasEstadaMinima,
    summary?.promedioDiasEstadaMaxima
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-100">
            <th className="text-left px-4 py-3 font-semibold text-slate-700 rounded-tl-lg">
              Especialidad
            </th>
            <th className="text-center px-4 py-3 font-semibold text-slate-700">
              Días-cama del período
            </th>
            <th className="text-center px-4 py-3 font-semibold text-slate-700">
              Egresos del período
            </th>
            <th className="text-center px-4 py-3 font-semibold text-slate-700">
              Fallecidos del período
            </th>
            <th className="text-center px-4 py-3 font-semibold text-slate-700">
              Traslados del período
            </th>
            <th className="text-center px-4 py-3 font-semibold text-slate-700">
              Aerocardal del período
            </th>
            <th className="text-center px-4 py-3 font-semibold text-slate-700">FACH del período</th>
            <th className="text-center px-4 py-3 font-semibold text-slate-700">
              Contribución del período
            </th>
            <th className="text-center px-4 py-3 font-semibold text-slate-700">
              Mortalidad del período
            </th>
            <th className="text-center px-4 py-3 font-semibold text-slate-700">
              Estada media de egresos
            </th>
            <th className="text-center px-4 py-3 font-semibold text-slate-700 rounded-tr-lg">
              Rango estada egresos
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => {
            const egresos = row.egresos ?? 0;
            const fallecidos = row.fallecidos ?? 0;
            const traslados = row.traslados ?? 0;
            const aerocardal = row.aerocardal ?? 0;
            const fach = row.fach ?? 0;
            return (
              <tr
                key={row.specialty}
                className={`border-b border-slate-100 ${
                  index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                } hover:bg-sky-50 transition-colors`}
              >
                <td className="px-4 py-3 font-medium text-slate-800">
                  {row.specialty || 'Sin Especialidad'}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() =>
                      handleOpenTraceability(
                        String(row.specialty),
                        'dias-cama',
                        row.diasOcupadosList
                      )
                    }
                    className="inline-flex items-center justify-center min-w-[2rem] px-2 py-1 bg-sky-100 text-sky-700 rounded-full font-semibold hover:bg-sky-200 transition-colors cursor-pointer"
                    title="Ver detalle de pacientes"
                  >
                    {row.diasOcupados}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() =>
                      handleOpenTraceability(String(row.specialty), 'egresos', row.egresosList)
                    }
                    className={`font-medium hover:underline cursor-pointer ${
                      egresos > 0 ? 'text-slate-700' : 'text-slate-400'
                    }`}
                    disabled={egresos === 0}
                  >
                    {egresos}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() =>
                      handleOpenTraceability(
                        String(row.specialty),
                        'fallecidos',
                        row.fallecidosList
                      )
                    }
                    className={`font-medium hover:underline cursor-pointer ${
                      fallecidos > 0 ? 'text-red-600' : 'text-slate-400'
                    }`}
                    disabled={fallecidos === 0}
                  >
                    {fallecidos}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() =>
                      handleOpenTraceability(String(row.specialty), 'traslados', row.trasladosList)
                    }
                    className={`font-medium hover:underline cursor-pointer ${
                      traslados > 0 ? 'text-amber-600' : 'text-slate-400'
                    }`}
                    disabled={traslados === 0}
                  >
                    {traslados}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() =>
                      handleOpenTraceability(
                        String(row.specialty),
                        'aerocardal',
                        row.aerocardalList
                      )
                    }
                    className={`font-medium hover:underline cursor-pointer ${
                      aerocardal > 0 ? 'text-cyan-700' : 'text-slate-400'
                    }`}
                    disabled={aerocardal === 0}
                    title="Ver detalle Aerocardal"
                  >
                    {aerocardal}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() =>
                      handleOpenTraceability(String(row.specialty), 'fach', row.fachList)
                    }
                    className={`font-medium hover:underline cursor-pointer ${
                      fach > 0 ? 'text-indigo-700' : 'text-slate-400'
                    }`}
                    disabled={fach === 0}
                    title="Ver detalle FACH"
                  >
                    {fach}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-sky-500 rounded-full"
                        style={{ width: `${Math.min(row.contribucionRelativa, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-600 min-w-[3rem]">
                      {row.contribucionRelativa.toFixed(1)}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span
                    className={`font-medium ${
                      row.tasaMortalidad > 5
                        ? 'text-red-600'
                        : row.tasaMortalidad > 0
                          ? 'text-orange-600'
                          : 'text-slate-400'
                    }`}
                  >
                    {row.tasaMortalidad.toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {row.promedioDiasEstada.toFixed(2)} días
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenTraceability(String(row.specialty), 'estada', row.egresosList)
                    }
                    className="hover:underline cursor-pointer"
                    aria-label={`Ver casos de estada de ${row.specialty || 'Sin Especialidad'}`}
                    title="Ver casos que componen el rango de estada"
                  >
                    {formatRange(row.promedioDiasEstadaMinima, row.promedioDiasEstadaMaxima)}
                  </button>
                </td>
              </tr>
            );
          })}
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
            <td className="px-4 py-3 text-left text-slate-800">Total</td>
            <td className="px-4 py-3 text-center text-slate-800">{totalPacientesActuales}</td>
            <td className="px-4 py-3 text-center text-slate-800">{totalEgresos}</td>
            <td className="px-4 py-3 text-center text-slate-800">{totalFallecidos}</td>
            <td className="px-4 py-3 text-center text-slate-800">{totalTraslados}</td>
            <td className="px-4 py-3 text-center text-slate-800">{totalAerocardal}</td>
            <td className="px-4 py-3 text-center text-slate-800">{totalFach}</td>
            <td className="px-4 py-3 text-center text-slate-800">100.0%</td>
            <td className="px-4 py-3 text-center text-slate-800">{totalMortalidad.toFixed(1)}%</td>
            <td className="px-4 py-3 text-center text-slate-800">
              {totalPromedioDiasEstada.toFixed(2)} días
            </td>
            <td className="px-4 py-3 text-center text-slate-800">{totalRange}</td>
          </tr>
        </tbody>
      </table>

      {/* Traceability Modal */}
      <TraceabilityModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))}
        title={modalConfig.title}
        patients={modalConfig.patients}
        type={modalConfig.type}
        onOpenCensusDate={onOpenCensusDate}
      />
    </div>
  );
};

export default SpecialtyBreakdownTable;
