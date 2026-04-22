import type { LabResultRow } from '@/types/domain/labExamTypes';
import type { LabTrendPoint } from '@/types/domain/labAnalyticsTypes';
import { parseRefRange } from './labFormattingController';
import {
  collectMicrobiologyFinding,
  resolveMicrobiologyCategoryForFinding,
} from './labMicrobiologyAnalyticsController';
import type { DetailProcessingContext } from './labAnalyticsContracts';
import { isExcludedFromComparison, isTrendVariable } from './labAnalyticsVariableController';

const isUrineComparisonExcluded = (finding: LabResultRow): boolean => {
  const normalizeToken = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[°º]/g, ' ')
      .replace(/[^A-Za-z0-9]+/g, ' ')
      .toUpperCase();

  const upperSection = normalizeToken(String(finding.section || ''));
  const upperAnalysis = normalizeToken(String(finding.analysis || ''));
  const upperResult = normalizeToken(String(finding.result || ''));
  if (finding.analysis === 'RPC' || finding.analysis === 'RAC') {
    return false;
  }

  const isUrineAnalysis =
    upperAnalysis.includes('ORINA FISICO QUIMICO') ||
    upperAnalysis.includes('SEDIMENTO URINARIO') ||
    upperAnalysis.includes('CUERPOS CETON') ||
    upperAnalysis.includes('NITRIT') ||
    upperAnalysis.includes('SANGRE') ||
    upperAnalysis.includes('UROBILIN') ||
    upperAnalysis.includes('GLUCOSA') ||
    upperAnalysis.includes('BILIRRUBINA') ||
    upperAnalysis.includes('DENSIDAD') ||
    upperAnalysis.includes('ASPECTO') ||
    upperAnalysis.includes('COLOR') ||
    upperAnalysis === 'PROTEINAS' ||
    upperAnalysis.includes('PROTEINURIA') ||
    upperAnalysis.includes('CREATININURIA') ||
    upperAnalysis.includes('MICROALBUMINURIA') ||
    upperAnalysis.includes('BACTERIAS') ||
    upperAnalysis.includes('CILINDROS') ||
    upperAnalysis.includes('PLACAS DE PUS') ||
    upperAnalysis.includes('ERITROCITOS');

  const isQualitativeUrineLeukocyte =
    upperAnalysis.includes('LEUCOCITOS') &&
    /NEGATIVO|NO SE OBSERVA|ESCASA|MODERADA|ABUNDANTE|\+|X CAMPO/.test(upperResult);

  const isUrineMetadata =
    upperAnalysis.includes('MIDAS') ||
    upperResult.includes('MIDAS') ||
    (upperAnalysis.includes('INGRESO') && upperAnalysis.includes('MIDAS')) ||
    upperAnalysis.includes('FECHA Y HORA INGRESO SOLICITUD') ||
    upperAnalysis.includes('FECHA Y HORA VALIDACION') ||
    upperAnalysis.includes('DIRECTOR TECNICO') ||
    upperAnalysis.includes('RESULTADO VIA WEB');

  return (
    upperSection.includes('ORINA') ||
    upperSection.includes('SEDIMENTO') ||
    upperSection.includes('ORINA FISICO') ||
    upperSection.includes('FISICO-QUIMICO') ||
    upperSection.includes('QUIMICA/ORINA') ||
    isUrineMetadata ||
    isUrineAnalysis ||
    isQualitativeUrineLeukocyte
  );
};

const collectBilirubinFinding = (
  bilirubinByCol: Record<string, { total?: string; directa?: string; indirecta?: string }>,
  colKey: string,
  lowerAnalysis: string,
  result: string
) => {
  if (!lowerAnalysis.includes('bilirrubina')) {
    return;
  }

  if (!bilirubinByCol[colKey]) bilirubinByCol[colKey] = {};
  if (lowerAnalysis.includes('total')) bilirubinByCol[colKey].total = result;
  else if (lowerAnalysis.includes('directa')) bilirubinByCol[colKey].directa = result;
  else if (lowerAnalysis.includes('indirecta')) bilirubinByCol[colKey].indirecta = result;
};

const collectComparisonFinding = (
  comparison: Record<string, Record<string, LabResultRow>>,
  seenComparison: Set<string>,
  colKey: string,
  finding: LabResultRow,
  lowerAnalysis: string
) => {
  if (
    isExcludedFromComparison(finding.analysis) ||
    lowerAnalysis.includes('bilirrubina') ||
    isUrineComparisonExcluded(finding)
  ) {
    return;
  }

  const compKey = `${finding.analysis}::${colKey}`;
  if (seenComparison.has(compKey)) {
    return;
  }

  seenComparison.add(compKey);
  if (!comparison[finding.analysis]) comparison[finding.analysis] = {};
  comparison[finding.analysis][colKey] = finding;
};

const collectTrendFinding = (
  trendMap: Record<string, LabTrendPoint[]>,
  seenTrend: Set<string>,
  colKey: string,
  isoDate: string,
  finding: LabResultRow
) => {
  if (!isTrendVariable(finding.analysis) || finding.qualitative) {
    return;
  }

  const trendKey = `${finding.analysis}::${colKey}`;
  if (seenTrend.has(trendKey)) {
    return;
  }

  seenTrend.add(trendKey);
  const numValue = parseFloat(finding.result.replace(',', '.'));
  if (isNaN(numValue)) {
    return;
  }

  if (!trendMap[finding.analysis]) trendMap[finding.analysis] = [];
  const range = parseRefRange(finding.refValue);
  trendMap[finding.analysis].push({
    date: colKey,
    isoDate,
    value: numValue,
    unit: finding.unit,
    refMin: range?.min,
    refMax: range?.max,
  });
};

export const collectExamFinding = (finding: LabResultRow, input: DetailProcessingContext) => {
  if (input.suppressedAnalyses.has(finding.analysis)) {
    return;
  }

  const lowerAnalysis = finding.analysis.toLowerCase();
  const microbiologyCategory = resolveMicrobiologyCategoryForFinding(
    finding,
    input.microbiologyCategories
  );

  if (microbiologyCategory) {
    collectMicrobiologyFinding(
      finding,
      input.microbiologyCategories,
      input.microbiologyFindingsByCategory
    );
    return;
  }

  collectBilirubinFinding(input.bilirubinByCol, input.colKey, lowerAnalysis, finding.result);
  collectComparisonFinding(
    input.comparison,
    input.seenComparison,
    input.colKey,
    finding,
    lowerAnalysis
  );
  collectTrendFinding(input.trendMap, input.seenTrend, input.colKey, input.isoDate, finding);
};
