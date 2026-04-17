/**
 * Consent PDF Generator
 *
 * Generates a 1-page institutional consent document for clinical photography.
 * Uses jsPDF for generation — dynamic import to keep bundle size small.
 */

import { getBase64ImageFromURL } from '@/services/pdf/handoffPdfUtils';
import {
  HOSPITAL_LOGO_PATH,
  HOSPITAL_NAME,
  HOSPITAL_SUBTITLE,
  HOSPITAL_LOCATION,
} from '../constants';

interface ConsentPdfInput {
  patientName: string;
  patientRut: string;
  admissionDate?: string;
}

const formatDate = (iso?: string): string => {
  if (!iso) return '____/____/________';
  try {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  } catch {
    return iso;
  }
};

const todayFormatted = (): string => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

export const generateConsentPdf = async (input: ConsentPdfInput): Promise<void> => {
  const [{ default: jsPDF }] = await Promise.all([import('jspdf')]);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // --- Header with logo ---
  try {
    const logoData = await getBase64ImageFromURL(HOSPITAL_LOGO_PATH);
    doc.addImage(logoData, 'PNG', margin, y, 15, 15);
  } catch {
    // Continue without logo
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(HOSPITAL_NAME, margin + 18, y + 6);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(HOSPITAL_SUBTITLE, margin + 18, y + 11);
  doc.text(HOSPITAL_LOCATION, margin + 18, y + 15);

  y += 25;

  // --- Horizontal line ---
  doc.setDrawColor(0, 120, 200);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // --- Title ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('CONSENTIMIENTO INFORMADO', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(11);
  doc.text('Registro Fotográfico de Curaciones', pageWidth / 2, y, { align: 'center' });
  y += 10;

  // --- Patient data ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const fieldY = y;
  doc.setFont('helvetica', 'bold');
  doc.text('Nombre del paciente:', margin, fieldY);
  doc.setFont('helvetica', 'normal');
  doc.text(input.patientName || '___________________________________', margin + 42, fieldY);

  doc.setFont('helvetica', 'bold');
  doc.text('RUT:', margin, fieldY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(input.patientRut || '____________________', margin + 12, fieldY + 7);

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de ingreso:', margin + 80, fieldY + 7);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(input.admissionDate), margin + 115, fieldY + 7);

  y = fieldY + 16;

  // --- Horizontal separator ---
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // --- Body text ---
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');

  const bodyText = [
    'Yo, el/la paciente abajo firmante (o su representante legal), declaro que he sido informado/a por el equipo de salud del Hospital Hanga Roa sobre lo siguiente:',
    '',
    '1.  Durante mi hospitalización, el equipo de enfermería podría realizar un registro fotográfico de las curaciones efectuadas, con el fin de documentar la evolución clínica de las heridas o lesiones tratadas.',
    '',
    '2.  Las fotografías serán utilizadas exclusivamente como parte de mi registro clínico y ficha de hospitalización, para facilitar el seguimiento y la continuidad del cuidado entre los distintos turnos del equipo de salud.',
    '',
    '3.  Las imágenes NO serán utilizadas con fines académicos, de investigación, publicación científica ni difusión de ningún tipo.',
    '',
    '4.  Las fotografías serán almacenadas en un sistema digital seguro con acceso restringido únicamente al personal clínico autorizado del Hospital Hanga Roa.',
    '',
    '5.  Puedo revocar este consentimiento en cualquier momento, informando al equipo de enfermería a cargo de mi atención.',
  ];

  const lineHeight = 5;
  for (const line of bodyText) {
    if (line === '') {
      y += 2;
      continue;
    }
    // Handle line wrapping
    const wrapped = doc.splitTextToSize(line, contentWidth);
    for (const wrappedLine of wrapped) {
      doc.text(wrappedLine, margin, y);
      y += lineHeight;
    }
  }

  y += 6;

  // --- Highlighted box: key statement ---
  doc.setFillColor(240, 248, 255);
  doc.setDrawColor(0, 120, 200);
  doc.setLineWidth(0.5);
  doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    'Autorizo la toma de fotografías de mis curaciones con fines exclusivos de registro clínico.',
    pageWidth / 2,
    y + 6,
    { align: 'center' }
  );
  doc.text('NO autorizo su uso con fines académicos ni de investigación.', pageWidth / 2, y + 11, {
    align: 'center',
  });

  y += 22;

  // --- Signature area ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setDrawColor(0, 0, 0);

  const sigLineWidth = 65;
  const sigLeft = margin;
  const sigRight = pageWidth - margin - sigLineWidth;

  // Left: patient signature
  doc.line(sigLeft, y + 15, sigLeft + sigLineWidth, y + 15);
  doc.setFontSize(9);
  doc.text('Firma del Paciente o Representante Legal', sigLeft, y + 20);
  doc.text(`RUT: ${input.patientRut || '____________________'}`, sigLeft, y + 25);

  // Right: staff witness
  doc.line(sigRight, y + 15, sigRight + sigLineWidth, y + 15);
  doc.text('Firma del Profesional de Salud', sigRight, y + 20);
  doc.text('Nombre: ____________________________', sigRight, y + 25);

  y += 35;

  // --- Date and place ---
  doc.setFontSize(9);
  doc.text(`Fecha: ${todayFormatted()}`, margin, y);
  doc.text('Lugar: Hospital Hanga Roa, Rapa Nui', margin + 60, y);

  // --- Footer ---
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    'Hospital Hanga Roa — Sistema Estadístico de Hospitalizados — Documento generado automáticamente',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );

  // Open print dialog
  doc.autoPrint();
  window.open(doc.output('bloburl'), '_blank');
};
