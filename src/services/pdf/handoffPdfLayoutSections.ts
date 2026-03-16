import type { jsPDF } from 'jspdf';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { ShiftType } from '@/types/domain/base';
import { formatDateDDMMYYYY } from '@/utils/dateUtils';
import { getBase64ImageFromURL, getHandoffStaffInfo, Schedule } from './handoffPdfUtils';

export const addHandoffHeader = async (
  doc: jsPDF,
  record: DailyRecord,
  isMedical: boolean,
  selectedShift: ShiftType,
  schedule: Schedule,
  margin: number,
  logoSize: number
) => {
  const pageWidth = doc.internal.pageSize.width;

  try {
    const logoData = await getBase64ImageFromURL('/images/logos/logo_HHR.svg');
    doc.addImage(logoData, 'PNG', margin, margin, logoSize, logoSize);
  } catch (error) {
    console.warn('Could not load logo for PDF', error);
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const title = isMedical
    ? 'ENTREGA DE TURNO MEDICO'
    : `ENTREGA TURNO ENFERMERIA - ${selectedShift === 'day' ? 'LARGO' : 'NOCHE'}`;
  doc.text(title, margin + logoSize + 4, margin + 4);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('HOSPITAL HANGA ROA', margin + logoSize + 4, margin + 9);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(formatDateDDMMYYYY(record.date), pageWidth - margin, margin + 4, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  const shiftLabel = selectedShift === 'day' ? 'TURNO LARGO' : 'TURNO NOCHE';
  const shiftHours =
    selectedShift === 'day'
      ? `(${schedule?.dayStart || '08:00'} - ${schedule?.dayEnd || '20:00'})`
      : `(${schedule?.nightStart || '20:00'} - ${schedule?.nightEnd || '08:00'})`;

  if (!isMedical) {
    doc.text(`${shiftLabel} ${shiftHours}`, pageWidth - margin, margin + 9, { align: 'right' });
  }

  return margin + 18;
};

export const addStaffAndChecklist = (
  doc: jsPDF,
  record: DailyRecord,
  selectedShift: ShiftType,
  margin: number,
  startY: number
) => {
  let currentY = startY;
  const { delivers, receives, tens } = getHandoffStaffInfo(record, selectedShift);
  const columnDeliversX = margin;
  const columnReceivesX = margin + 65;
  const columnTensX = margin + 125;
  const columnWidth = 55;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bolditalic');
  doc.text('ENFERMERO(A) ENTREGA:', columnDeliversX, currentY);
  doc.text('ENFERMERO(A) RECIBE:', columnReceivesX, currentY);
  doc.text('TENS DE TURNO:', columnTensX, currentY);

  currentY += 4;
  doc.setFont('helvetica', 'normal');

  const deliversWrapped = doc.splitTextToSize(
    delivers.filter(Boolean).join(', ') || '-',
    columnWidth
  );
  const receivesWrapped = doc.splitTextToSize(
    receives.filter(Boolean).join(', ') || '-',
    columnWidth
  );
  const tensWrapped = doc.splitTextToSize(tens.filter(Boolean).join(', ') || '-', columnWidth + 15);

  doc.text(deliversWrapped, columnDeliversX, currentY);
  doc.text(receivesWrapped, columnReceivesX, currentY);
  doc.text(tensWrapped, columnTensX, currentY);

  currentY += Math.max(deliversWrapped.length, receivesWrapped.length, tensWrapped.length) * 4 + 1;

  const checklist =
    selectedShift === 'day' ? record.handoffDayChecklist : record.handoffNightChecklist;
  if (!checklist) {
    return currentY;
  }

  type FullChecklist = {
    escalaBraden?: boolean;
    escalaRiesgoCaidas?: boolean;
    escalaRiesgoLPP?: boolean;
    estadistica?: boolean;
    categorizacionCudyr?: boolean;
    encuestaUTI?: boolean;
    encuestaMedias?: boolean;
    conteoMedicamento?: boolean;
    conteoNoControlados?: boolean;
    conteoNoControladosProximaFecha?: string;
  };

  const cl = checklist as FullChecklist;
  const checklistItems: string[] = [];

  if (selectedShift === 'day') {
    if (cl.escalaBraden) checklistItems.push('Escala Braden: OK');
    if (cl.escalaRiesgoCaidas) checklistItems.push('Riesgo Caidas: OK');
    if (cl.escalaRiesgoLPP) checklistItems.push('Evaluacion LPP: OK');
  } else {
    if (cl.estadistica) checklistItems.push('Estadistica: OK');
    if (cl.categorizacionCudyr) checklistItems.push('Categorizacion CUDYR: OK');
    if (cl.encuestaUTI) checklistItems.push('Encuesta UTI: OK');
    if (cl.encuestaMedias) checklistItems.push('Encuesta Medias: OK');
    if (cl.conteoMedicamento) checklistItems.push('Farmacos Controlados: OK');
    if (cl.conteoNoControlados) {
      checklistItems.push(
        `Farmacos No-Controlados: OK${
          cl.conteoNoControladosProximaFecha
            ? ` (PROX: ${formatDateDDMMYYYY(cl.conteoNoControladosProximaFecha)})`
            : ''
        }`
      );
    }
  }

  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.text(
    checklistItems.length > 0
      ? `CHECKLIST: ${checklistItems.join(' | ')}`
      : 'CHECKLIST: Sin items completados',
    margin,
    currentY
  );

  return currentY + 4;
};

export const addNovedadesSection = (
  doc: jsPDF,
  novedadesText: string | undefined,
  margin: number,
  startY: number
) => {
  let currentY = startY;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  if (!novedadesText) return currentY;

  if (currentY + 20 > pageHeight) {
    doc.addPage();
    currentY = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('NOVEDADES DEL TURNO', margin, currentY);
  currentY += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  let novedadesY = currentY;
  for (const line of novedadesText.split(/\r?\n/)) {
    if (line.trim() === '') {
      novedadesY += 2;
    } else {
      const wrappedLines = doc.splitTextToSize(
        line.replace(/[\u0000-\u001F\u007F-\u009F]/g, ''),
        pageWidth - margin * 2
      );
      doc.text(wrappedLines, margin, novedadesY);
      novedadesY += wrappedLines.length * 4;
    }

    if (novedadesY > pageHeight - margin) {
      doc.addPage();
      novedadesY = margin;
    }
  }

  return novedadesY + 6;
};

export const addPageFooter = (doc: jsPDF, margin: number) => {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(`Pagina ${i} de ${pageCount}`, pageWidth - margin, pageHeight - margin + 4, {
      align: 'right',
    });
  }
};
