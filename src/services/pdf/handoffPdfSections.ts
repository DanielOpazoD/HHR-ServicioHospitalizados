import type { jsPDF } from 'jspdf';
import { DailyRecord, PatientData, ShiftType, DeviceDetails } from '@/types';
import { BEDS } from '@/constants';
import { formatDateDDMMYYYY } from '../dataService';
import { calculateHospitalizedDays } from './handoffPdfUtils';
export { addCudyrTable } from './handoffPdfCudyrSection';
export {
  addHandoffHeader,
  addNovedadesSection,
  addPageFooter,
  addStaffAndChecklist,
} from './handoffPdfLayoutSections';
export type { AutoTableFunction, JsPDFWithAutoTable } from './handoffPdfTypes';
import { CellHookData, AutoTableFunction, JsPDFWithAutoTable } from './handoffPdfTypes';

export const addPatientTable = (
  doc: jsPDF,
  record: DailyRecord,
  isMedical: boolean,
  selectedShift: ShiftType,
  currentY: number,
  autoTable: AutoTableFunction
) => {
  const tableHeaders = [['Cama', 'Paciente', 'Diagnóstico', 'Est', 'DMI', 'Observaciones']];
  type TableRow = (
    | string
    | { content: string; colSpan?: number; styles?: Record<string, unknown> }
    | { content: string; styles: Record<string, unknown> }
  )[] & { _daysStr?: string };
  const tableBody: TableRow[] = [];

  const formatDevices = (p: PatientData): string => {
    if (!p.devices || !Array.isArray(p.devices) || p.devices.length === 0) return '';
    return p.devices
      .map((d: string) => {
        const detail = p.deviceDetails?.[d as keyof DeviceDetails];
        let daysStr = '';
        if (detail?.installationDate) {
          const diffDays = calculateHospitalizedDays(detail.installationDate, record.date);
          if (diffDays && diffDays > 0) daysStr = ` (${diffDays}d)`;
        }
        return `${d}${daysStr}`;
      })
      .join(', ');
  };

  BEDS.forEach(bedDef => {
    const patient = record.beds[bedDef.id];
    if (!patient || !patient.patientName) return;

    const admission = patient.admissionDate ? formatDateDDMMYYYY(patient.admissionDate) : '';
    const daysHosp = calculateHospitalizedDays(patient.admissionDate, record.date);
    const daysStr = daysHosp ? `${daysHosp}d` : '';

    const observation = isMedical
      ? patient.medicalHandoffNote || ''
      : selectedShift === 'day'
        ? patient.handoffNoteDayShift || ''
        : patient.handoffNoteNightShift || '';

    const devicesStr = formatDevices(patient);

    const row: TableRow = [
      { content: bedDef.name, styles: { halign: 'center', fontStyle: 'bold', valign: 'top' } },
      {
        content: `${patient.patientName}\n${patient.rut || ''} ${patient.age ? `(${patient.age})` : ''}\nFI: ${admission}`,
        styles: { fontStyle: 'normal' },
      },
      patient.pathology || '',
      patient.status || '',
      devicesStr,
      observation,
    ];
    (row as unknown as { _daysStr: string })._daysStr = daysStr;
    tableBody.push(row);

    if (patient.clinicalCrib && patient.clinicalCrib.patientName) {
      const crib = patient.clinicalCrib;
      const cribObservation = isMedical
        ? crib.medicalHandoffNote || ''
        : selectedShift === 'day'
          ? crib.handoffNoteDayShift || ''
          : crib.handoffNoteNightShift || '';
      const cribDevices = formatDevices(crib);
      const cribAdmission = crib.admissionDate ? formatDateDDMMYYYY(crib.admissionDate) : '';

      tableBody.push([
        { content: 'Cuna', styles: { halign: 'center', textColor: [236, 72, 153] } },
        {
          content: `${crib.patientName} (RN)\nFI: ${cribAdmission}`,
          styles: { textColor: [236, 72, 153], fontStyle: 'normal' },
        },
        crib.pathology || '',
        crib.status || '',
        cribDevices,
        cribObservation,
      ]);
    }
  });

  if (tableBody.length === 0) {
    tableBody.push([
      { content: 'No hay pacientes registrados.', colSpan: 6, styles: { halign: 'center' } },
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    head: tableHeaders,
    body: tableBody,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: 1,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: 0,
      fontStyle: 'bold',
      lineWidth: 0.1,
      lineColor: [180, 180, 180],
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 35 },
      2: { cellWidth: 40 },
      3: { cellWidth: 15 },
      4: { cellWidth: 25 },
      5: { cellWidth: 'auto' },
    },
    didParseCell: (hookData: CellHookData) => {
      if (hookData.section === 'body' && hookData.column.index === 3) {
        const status = ((hookData.cell.raw as string) || '').toLowerCase();
        if (status === 'grave') {
          hookData.cell.styles.textColor = [185, 28, 28];
          hookData.cell.styles.fontStyle = 'bold';
        } else if (status === 'de cuidado') {
          hookData.cell.styles.textColor = [194, 65, 12];
        } else if (status === 'estable') {
          hookData.cell.styles.textColor = [21, 128, 61];
        }
      }
    },
    didDrawCell: (hookData: CellHookData) => {
      if (hookData.section === 'body' && hookData.column.index === 0) {
        const rowData = tableBody[hookData.row.index];
        const daysStr = (rowData as unknown as { _daysStr: string })._daysStr;
        if (daysStr) {
          doc.setFontSize(7);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(120, 120, 120);
          doc.text(
            daysStr,
            hookData.cell.x + hookData.cell.width / 2,
            hookData.cell.y + hookData.cell.height - 2,
            { align: 'center' }
          );
          doc.setTextColor(0, 0, 0);
        }
      }
    },
  });

  return (doc as JsPDFWithAutoTable).lastAutoTable.finalY || currentY;
};

// ============================================================================
// Section: Summary of Movements
// ============================================================================

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

  // Altas
  doc.setFontSize(9);
  doc.text('ALTAS:', margin, currentY);
  if (record.discharges && record.discharges.length > 0) {
    currentY += 2;
    autoTable(doc, {
      startY: currentY,
      head: [['Cama', 'Paciente', 'Diagnóstico', 'Destino/Tipo']],
      body: record.discharges.map(d => [
        d.bedName,
        d.patientName + (d.rut ? ` - ${d.rut}` : ''),
        d.diagnosis,
        d.status === 'Fallecido' ? 'Fallecido' : d.dischargeType || 'Domicilio',
      ]),
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    });
    currentY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.text(' Sin altas', margin + 12, currentY);
    currentY += 5;
  }

  // Traslados
  doc.setFont('helvetica', 'bold');
  doc.text('TRASLADOS:', margin, currentY);
  if (record.transfers && record.transfers.length > 0) {
    currentY += 2;
    autoTable(doc, {
      startY: currentY,
      head: [['Origen', 'Paciente', 'Diagnóstico', 'Destino', 'Medio']],
      body: record.transfers.map(t => [
        t.bedName,
        t.patientName,
        t.diagnosis,
        t.receivingCenter,
        t.evacuationMethod,
      ]),
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    });
    currentY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.text(' Sin traslados', margin + 22, currentY);
    currentY += 5;
  }

  // CMA
  doc.setFont('helvetica', 'bold');
  doc.text('HOSPITALIZACIÓN DIURNA (CMA):', margin, currentY);
  if (record.cma && record.cma.length > 0) {
    currentY += 2;
    autoTable(doc, {
      startY: currentY,
      head: [['Paciente', 'RUT', 'Intervención', 'Tipo']],
      body: record.cma.map(c => [c.patientName, c.rut, c.diagnosis, c.interventionType]),
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 1, lineColor: [200, 200, 200], lineWidth: 0.1 },
      headStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
    });
    currentY = (doc as JsPDFWithAutoTable).lastAutoTable.finalY + 4;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.text(' Sin hospitalizaciones diurnas', margin + 55, currentY);
    currentY += 5;
  }

  return currentY;
};
