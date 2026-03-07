export interface AnalyticsPresentationCopy {
  periodOccupancyTitle: string;
  periodOccupancySubtitle: string;
  periodStayTitle: string;
  periodStaySubtitle: string;
  periodDischargesTitle: string;
  periodDischargesSubtitle: string;
  periodMortalityTitle: string;
  periodMortalitySubtitle: string;
  periodRotationTitle: string;
  periodRotationSubtitle: string;
  periodBedDaysTitle: string;
  periodBedDaysSubtitle: string;
  trendTitle: string;
  trendSubtitle: string;
  trendOccupancyLabel: string;
  trendAverageLabel: string;
  currentSnapshotTitle: string;
  currentSnapshotSubtitle: string;
  currentOccupancyLabel: string;
}

export const DEFAULT_ANALYTICS_PRESENTATION_COPY: AnalyticsPresentationCopy = {
  periodOccupancyTitle: 'Ocupación del período',
  periodOccupancySubtitle: 'Promedio del rango seleccionado',
  periodStayTitle: 'Estada media del período',
  periodStaySubtitle: 'Promedio de hospitalización del rango',
  periodDischargesTitle: 'Egresos del período',
  periodDischargesSubtitle: 'Altas, fallecidos y traslados del rango',
  periodMortalityTitle: 'Mortalidad del período',
  periodMortalitySubtitle: 'Fallecidos sobre egresos del rango',
  periodRotationTitle: 'Rotación del período',
  periodRotationSubtitle: 'Egresos por cama dentro del rango',
  periodBedDaysTitle: 'Días cama del período',
  periodBedDaysSubtitle: 'Ocupados dentro del rango seleccionado',
  trendTitle: 'Tendencia diaria de ocupación',
  trendSubtitle: 'Serie diaria del rango seleccionado',
  trendOccupancyLabel: 'Ocupación del día',
  trendAverageLabel: 'Promedio del período',
  currentSnapshotTitle: 'Situación actual',
  currentSnapshotSubtitle: 'Último registro disponible del rango seleccionado',
  currentOccupancyLabel: 'Ocupación Actual',
};

export const resolveAnalyticsPresentationCopy = (): AnalyticsPresentationCopy =>
  DEFAULT_ANALYTICS_PRESENTATION_COPY;
