import type { jsPDF } from 'jspdf';

import { DailyRecord } from '@/types/domain/dailyRecord';

import type { AutoTableFunction, JsPDFWithAutoTable } from './handoffPdfTypes';
import type { HandoffPdfMovementSummaryTable } from './handoffPdfSectionTypes';

export const buildMovementsSummaryTables = (
  record: DailyRecord
): HandoffPdfMovementSummaryTable[] => [
  {
    title: 'ALTAS:',
    emptyLabel: ' Sin altas',
    emptyOffsetX: 12,
    headers: [['Cama', 'Paciente', 'Diagnóstico', 'Destino/Tipo']],
    rows: (record.discharges || []).map(discharge => [
      discharge.bedName,
      discharge.patientName + (discharge.rut ? ` - ${discharge.rut}` : ''),
      discharge.diagnosis,
      discharge.status === 'Fallecido' ? 'Fallecido' : discharge.dischargeType || 'Domicilio',
    ]),
  },
  {
    title: 'TRASLADOS:',
    emptyLabel: ' Sin traslados',
    emptyOffsetX: 22,
    headers: [['Origen', 'Paciente', 'Diagnóstico', 'Destino', 'Medio']],
    rows: (record.transfers || []).map(transfer => [
      transfer.bedName,
      transfer.patientName,
      transfer.diagnosis,
      transfer.receivingCenter,
      transfer.evacuationMethod,
    ]),
  },
  {
    title: 'HOSPITALIZACIÓN DIURNA (CMA):',
    emptyLabel: ' Sin hospitalizaciones diurnas',
    emptyOffsetX: 55,
    headers: [['Paciente', 'RUT', 'Intervención', 'Tipo']],
    rows: (record.cma || []).map(cma => [
      cma.patientName,
      cma.rut,
      cma.diagnosis,
      cma.interventionType,
    ]),
  },
];

export const addMovementsSummary = (
  doc: jsPDF,
  record: DailyRecord,
  margin: number,
  startY: number,
  autoTable: AutoTableFunction
) => {
  let currentY = startY;
  const pageHeight = doc.internal.pageSize.height;

  if (currentY + 40 > pageHeight) {
    doc.addPage();
    currentY = margin;
  } else {
    currentY += 4;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('RESUMEN DE MOVIMIENTOS', margin, currentY);
  currentY += 6;

  buildMovementsSummaryTables(record).forEach(summaryTable => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(summaryTable.title, margin, currentY);

    if (summaryTable.rows.length > 0) {
      currentY += 2;
      autoTable(doc, {
        startY: currentY,
        head: summaryTable.headers,
        body: summaryTable.rows,
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: 1, lineColor: [200, 200, 200], lineWidth: 0.1 },
        headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
      });
      currentY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;
      return;
    }

    doc.setFont('helvetica', 'italic');
    doc.text(summaryTable.emptyLabel, margin + summaryTable.emptyOffsetX, currentY);
    currentY += 5;
  });

  return currentY;
};
