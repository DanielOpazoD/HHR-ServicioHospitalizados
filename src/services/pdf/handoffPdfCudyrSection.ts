import type { jsPDF } from 'jspdf';
import { BEDS } from '@/constants';
import { CudyrScore, DailyRecord } from '@/types';
import { formatDateDDMMYYYY } from '../dataService';
import { AutoTableFunction, CellHookData, JsPDFWithAutoTable } from './handoffPdfTypes';

const getCudyrScores = (score: CudyrScore) => {
  const dependency =
    (score.changeClothes || 0) +
    (score.mobilization || 0) +
    (score.feeding || 0) +
    (score.elimination || 0) +
    (score.psychosocial || 0) +
    (score.surveillance || 0);
  const risk =
    (score.vitalSigns || 0) +
    (score.fluidBalance || 0) +
    (score.oxygenTherapy || 0) +
    (score.airway || 0) +
    (score.proInterventions || 0) +
    (score.skinCare || 0) +
    (score.pharmacology || 0) +
    (score.invasiveElements || 0);

  return { dependency, risk };
};

const getCudyrCategory = (dependency: number, risk: number): string => {
  if (dependency <= 0 && risk <= 0) return '-';
  const dependencyCategory = dependency >= 13 ? '1' : dependency >= 7 ? '2' : '3';
  const riskCategory = risk >= 19 ? 'A' : risk >= 12 ? 'B' : risk >= 6 ? 'C' : 'D';
  return `${riskCategory}${dependencyCategory}`;
};

export const addCudyrTable = (
  doc: jsPDF,
  record: DailyRecord,
  margin: number,
  autoTable: AutoTableFunction
) => {
  doc.addPage();
  let currentY = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('INSTRUMENTO CUDYR', margin, currentY);
  currentY += 6;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');

  const lockTime = record.cudyrLockedAt
    ? new Date(record.cudyrLockedAt).toLocaleTimeString('es-CL', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '--:--';
  const nurses = (record.nursesNightShift || []).filter(n => n && n.trim() !== '');
  const nursesStr = nurses.length > 0 ? nurses.join(', ') : 'No registrados';

  doc.text(`Fecha: ${formatDateDDMMYYYY(record.date)}`, margin, currentY);
  if (record.cudyrLockedAt) {
    doc.text(` | Cierre CUDYR: ${lockTime}`, margin + 35, currentY);
  }

  currentY += 5;
  doc.text(`Enfermeros/as (Noche): ${nursesStr}`, margin, currentY);
  currentY += 8;

  const summaryCounts: Record<string, number> = {};
  let totalCategorized = 0;

  BEDS.forEach(bedDef => {
    const patient = record.beds[bedDef.id];
    if (!patient?.patientName) return;
    const { dependency, risk } = getCudyrScores((patient.cudyr || {}) as CudyrScore);
    const category = getCudyrCategory(dependency, risk);
    if (category === '-') return;
    summaryCounts[category] = (summaryCounts[category] || 0) + 1;
    totalCategorized++;
  });

  if (totalCategorized > 0) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('Resumen Estadistico:', margin, currentY);
    currentY += 4;

    const summaryText = Object.entries(summaryCounts)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([category, count]) => `${category}: ${count}`)
      .join('  |  ');

    doc.setFont('helvetica', 'normal');
    doc.text(`${summaryText}  (Total: ${totalCategorized})`, margin, currentY);
    currentY += 6;
  }

  const body: (string | number)[][] = [];

  BEDS.forEach(bedDef => {
    const patient = record.beds[bedDef.id];
    if (!patient?.patientName) return;

    const score = (patient.cudyr || {}) as CudyrScore;
    const { dependency, risk } = getCudyrScores(score);
    const category = getCudyrCategory(dependency, risk);
    const nameParts = patient.patientName.split(' ');
    const shortName =
      nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1].charAt(0)}.` : nameParts[0];

    body.push([
      bedDef.name,
      shortName,
      patient.rut || '-',
      score.changeClothes || 0,
      score.mobilization || 0,
      score.feeding || 0,
      score.elimination || 0,
      score.psychosocial || 0,
      score.surveillance || 0,
      score.vitalSigns || 0,
      score.fluidBalance || 0,
      score.oxygenTherapy || 0,
      score.airway || 0,
      score.proInterventions || 0,
      score.skinCare || 0,
      score.pharmacology || 0,
      score.invasiveElements || 0,
      dependency,
      risk,
      category,
    ]);
  });

  autoTable(doc, {
    startY: currentY,
    head: [
      [
        'Cama',
        'Nombre',
        'RUT',
        'Ropa',
        'Movil',
        'Alim',
        'Elim',
        'Psico',
        'Vigi',
        'S.Vit',
        'Bal',
        'O2',
        'Aere',
        'Intv',
        'Piel',
        'Tto',
        'Inv',
        'T.Dep',
        'T.Ries',
        'Cat',
      ],
    ],
    body,
    theme: 'grid',
    styles: {
      fontSize: 6.5,
      halign: 'center',
      cellPadding: 1,
      lineColor: [100, 100, 100],
      lineWidth: 0.1,
    },
    headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 10, halign: 'left', fontStyle: 'bold' },
      1: { cellWidth: 22, halign: 'left' },
      2: { cellWidth: 16, halign: 'center' },
      17: { cellWidth: 9, fontStyle: 'bold', fillColor: [240, 248, 255] },
      18: { cellWidth: 9, fontStyle: 'bold', fillColor: [254, 242, 242] },
      19: { cellWidth: 9, fontStyle: 'bold' },
    },
    didParseCell: (hookData: CellHookData) => {
      if (hookData.section !== 'body' || hookData.column.index !== 19) return;
      const value = hookData.cell.raw as string;
      if (value.startsWith('A')) {
        hookData.cell.styles.fillColor = [220, 38, 38];
        hookData.cell.styles.textColor = 255;
      } else if (value.startsWith('B')) {
        hookData.cell.styles.fillColor = [249, 115, 22];
        hookData.cell.styles.textColor = 255;
      } else if (value.startsWith('C')) {
        hookData.cell.styles.fillColor = [250, 204, 21];
        hookData.cell.styles.textColor = 0;
      } else if (value.startsWith('D')) {
        hookData.cell.styles.fillColor = [22, 163, 74];
        hookData.cell.styles.textColor = 255;
      }
    },
  });

  return (doc as JsPDFWithAutoTable).lastAutoTable.finalY || currentY;
};
