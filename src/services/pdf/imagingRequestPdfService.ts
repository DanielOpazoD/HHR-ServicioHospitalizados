/**
 * Imaging Request PDF Service — Solicitud de Imágenes
 *
 * Fills the official imaging request form template with patient data
 * using coordinate-based text injection (same pattern as ieehPdfService).
 *
 * COORDINATES SOURCE: User-provided JSON from PDF field mapping tool.
 * Template: public/docs/solicitud-imagen.pdf
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PatientData } from '@/types';
import {
  splitPatientName,
  calculateAge,
  formatDateToCL as formatDate,
} from '@/utils/clinicalUtils';
import { injectPrintScript, saveAndDownloadPdf } from './pdfBase';
import {
  SOLICITUD_FIELD_COORDS,
  ENCUESTA_FIELD_COORDS,
  CONSENTIMIENTO_FIELD_COORDS,
} from './imagingRequestPdfCoordinates';

// Re-export constants for backwards compatibility and tests
export { SOLICITUD_FIELD_COORDS, ENCUESTA_FIELD_COORDS, CONSENTIMIENTO_FIELD_COORDS };

export interface CustomMark {
  x: number; // Percentage 0-100 from left
  y: number; // Percentage 0-100 from top
  text?: string; // Optional custom text to draw instead of an 'X'
}

// ── Template PDF paths ──
export const SOLICITUD_TEMPLATE_PATH = '/docs/solicitud-imagen.pdf';
export const ENCUESTA_TEMPLATE_PATH = '/docs/encuesta-contraste.pdf';
export const CONSENTIMIENTO_TEMPLATE_PATH = '/docs/consentimiento.pdf';

// --- Constants ---
const FONT_SIZE = 10;
const TEXT_COLOR = rgb(0, 0, 0);

/**
 * Get today's date in DD-MM-YYYY format
 */
const getTodayFormatted = (): string => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

/**
 * Fill the imaging request form with patient data
 */
export const fillImagingRequestForm = async (
  patient: PatientData,
  requestingPhysician: string = '',
  marks: CustomMark[] = []
): Promise<Uint8Array> => {
  // 1. Load the template PDF
  const response = await fetch(SOLICITUD_TEMPLATE_PATH);
  const templateBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);

  // 2. Embed font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 3. Get page 1
  const page = pdfDoc.getPage(0);

  const drawText = (text: string, coords: { x: number; y: number; maxWidth: number }) => {
    if (!text) return;
    page.drawText(text.toUpperCase(), {
      x: coords.x,
      y: coords.y,
      size: FONT_SIZE,
      font,
      color: TEXT_COLOR,
    });
  };

  // 4. Extract patient data
  const [nombres, primerApellido, segundoApellido] = splitPatientName(patient.patientName);

  // 5. Fill fields
  drawText(nombres, SOLICITUD_FIELD_COORDS.nombres);
  drawText(primerApellido, SOLICITUD_FIELD_COORDS.primerApellido);
  drawText(segundoApellido, SOLICITUD_FIELD_COORDS.segundoApellido);
  drawText(patient.rut || '', SOLICITUD_FIELD_COORDS.rut);
  drawText(calculateAge(patient.birthDate), SOLICITUD_FIELD_COORDS.edad);
  drawText(formatDate(patient.birthDate), SOLICITUD_FIELD_COORDS.fechaNacimiento);

  // Diagnosis: Try pathology first, then cie10Description
  const diagValue = patient.pathology || patient.cie10Description || '';
  drawText(diagValue, SOLICITUD_FIELD_COORDS.diagnostico);

  drawText(getTodayFormatted(), SOLICITUD_FIELD_COORDS.fechaSolicitud);

  // Requesting Physician
  if (requestingPhysician) {
    drawText(requestingPhysician, SOLICITUD_FIELD_COORDS.medicoTratante);
  }

  // 6. Draw Custom 'X' or Text Marks
  marks.forEach(mark => {
    const xPos = page.getWidth() * (mark.x / 100);
    // PDF-lib Y is from bottom, so invert the percentage
    const yPos = page.getHeight() * (1 - mark.y / 100);

    if (mark.text) {
      page.drawText(mark.text.toUpperCase(), {
        x: xPos,
        y: yPos - 3, // slightly adjust to align nicely with typical click point
        size: FONT_SIZE, // FONT_SIZE is 10, same as standard text
        font,
        color: TEXT_COLOR,
      });
    } else {
      // The exact font size is 14.
      // We subtract roughly half the width/height to center the "X" exactly over the click point.
      // A 14pt Helvetica "X" is roughly 8pt wide and 10pt tall (ascender).
      page.drawText('X', {
        x: xPos - 4, // Center horizontally
        y: yPos - 4, // Center vertically
        size: 14,
        font,
        color: TEXT_COLOR,
      });
    }
  });

  // 7. Serialize
  const pdfBytes = await pdfDoc.save();
  return pdfBytes as unknown as Uint8Array;
};

/**
 * Fill the general informed consent form with patient data
 */
export const fillConsentimientoForm = async (
  patient: PatientData,
  requestingPhysician: string = '',
  marks: CustomMark[] = []
): Promise<Uint8Array> => {
  const response = await fetch(CONSENTIMIENTO_TEMPLATE_PATH);
  const templateBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPage(0);

  const drawText = (text: string, coords: { x: number; y: number; maxWidth: number }) => {
    if (!text) return;
    page.drawText(text.toUpperCase(), {
      x: coords.x,
      y: coords.y,
      size: FONT_SIZE,
      font,
      color: TEXT_COLOR,
    });
  };

  const [nombres, primerApellido, segundoApellido] = splitPatientName(patient.patientName);

  drawText(nombres, CONSENTIMIENTO_FIELD_COORDS.nombres);
  drawText(primerApellido, CONSENTIMIENTO_FIELD_COORDS.primerApellido);
  drawText(segundoApellido, CONSENTIMIENTO_FIELD_COORDS.segundoApellido);
  drawText(patient.rut || '', CONSENTIMIENTO_FIELD_COORDS.rut);
  drawText(calculateAge(patient.birthDate), CONSENTIMIENTO_FIELD_COORDS.edad);

  const diagValue = patient.pathology || patient.cie10Description || '';
  drawText(diagValue, CONSENTIMIENTO_FIELD_COORDS.diagnostico);
  drawText(getTodayFormatted(), CONSENTIMIENTO_FIELD_COORDS.fecha);

  if (requestingPhysician) {
    drawText(requestingPhysician, CONSENTIMIENTO_FIELD_COORDS.medicoTratante);
  }

  marks.forEach(mark => {
    const xPos = page.getWidth() * (mark.x / 100);
    const yPos = page.getHeight() * (1 - mark.y / 100);

    if (mark.text) {
      page.drawText(mark.text.toUpperCase(), {
        x: xPos,
        y: yPos - 3,
        size: FONT_SIZE,
        font,
        color: TEXT_COLOR,
      });
    } else {
      page.drawText('X', {
        x: xPos - 4,
        y: yPos - 4,
        size: 14,
        font,
        color: TEXT_COLOR,
      });
    }
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes as unknown as Uint8Array;
};

/**
 * Download the filled imaging request form
 */
export const downloadImagingRequestForm = async (
  patient: PatientData,
  requestingPhysician: string = '',
  marks: CustomMark[] = []
): Promise<void> => {
  const bytes = await fillImagingRequestForm(patient, requestingPhysician, marks);
  const patientName = patient.patientName || 'paciente';
  const safeName = patientName
    .replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const suggestedName = `SolicitudImagen_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;

  await saveAndDownloadPdf(bytes, suggestedName);
};

/**
 * Generate a Blob URL for the filled imaging request form
 * This is used for previewing the PDF in an iframe
 */
export const generateImagingRequestPreviewUrl = async (
  patient: PatientData,
  requestingPhysician: string = '',
  marks: CustomMark[] = []
): Promise<string> => {
  const pdfBytes = await fillImagingRequestForm(patient, requestingPhysician, marks);
  const blob = new Blob([pdfBytes as BlobPart], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
};

/**
 * Print the official Solicitud de Imágenes by injecting an auto-print script
 * and opening it in a hidden iframe (or a new tab as fallback)
 */
export const printImagingRequestForm = async (
  patient: PatientData,
  requestingPhysician: string = '',
  marks: CustomMark[] = []
): Promise<void> => {
  // 1. Generate PDF exactly like `fillImagingRequestForm`
  const filledBytes = await fillImagingRequestForm(patient, requestingPhysician, marks);

  // 2. Reload to inject the print script securely
  const printDoc = await PDFDocument.load(filledBytes);
  injectPrintScript(printDoc);

  const finalBytes = await printDoc.save();
  const blob = new Blob([finalBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  // 3. Open the PDF in a new tab to ensure standard print dialog isn't blocked
  const newWindow = window.open(url, '_blank');

  // Fallback if popup blocker prevented the new tab
  if (!newWindow) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `IMPRIMIR_Solicitud_${patient.patientName}.pdf`;
    link.click();
  }
};

/**
 * Print the official Consentimiento Informado by injecting an auto-print script
 */
export const printConsentimientoForm = async (
  patient: PatientData,
  requestingPhysician: string = '',
  marks: CustomMark[] = []
): Promise<void> => {
  const filledBytes = await fillConsentimientoForm(patient, requestingPhysician, marks);
  const printDoc = await PDFDocument.load(filledBytes);
  injectPrintScript(printDoc);

  const finalBytes = await printDoc.save();
  const blob = new Blob([finalBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const newWindow = window.open(url, '_blank');

  if (!newWindow) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `IMPRIMIR_Consentimiento_${patient.patientName}.pdf`;
    link.click();
  }
};

/**
 * Fill the Encuesta Medio Contraste form with patient data
 */
export const fillImagingEncuestaForm = async (
  patient: PatientData,
  requestingPhysician: string = '',
  marks: CustomMark[] = []
): Promise<Uint8Array> => {
  const response = await fetch(ENCUESTA_TEMPLATE_PATH);
  const templateBytes = await response.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page = pdfDoc.getPage(0);

  const drawText = (text: string, coords: { x: number; y: number; maxWidth: number }) => {
    if (!text) return;
    page.drawText(text.toUpperCase(), {
      x: coords.x,
      y: coords.y,
      size: FONT_SIZE,
      font,
      color: TEXT_COLOR,
    });
  };

  const [nombres, primerApellido, segundoApellido] = splitPatientName(patient.patientName);

  drawText(nombres, ENCUESTA_FIELD_COORDS.nombres);
  drawText(primerApellido, ENCUESTA_FIELD_COORDS.primerApellido);
  drawText(segundoApellido, ENCUESTA_FIELD_COORDS.segundoApellido);
  drawText(patient.rut || '', ENCUESTA_FIELD_COORDS.rut);
  drawText(calculateAge(patient.birthDate), ENCUESTA_FIELD_COORDS.edad);
  drawText(formatDate(patient.birthDate), ENCUESTA_FIELD_COORDS.fechaNacimiento);

  const diagValue = patient.pathology || patient.cie10Description || '';
  drawText(diagValue, ENCUESTA_FIELD_COORDS.diagnostico);

  if (requestingPhysician) {
    drawText(requestingPhysician, ENCUESTA_FIELD_COORDS.medicoTratante);
  }

  marks.forEach(mark => {
    const xPos = page.getWidth() * (mark.x / 100);
    const yPos = page.getHeight() * (1 - mark.y / 100);

    if (mark.text) {
      page.drawText(mark.text.toUpperCase(), {
        x: xPos,
        y: yPos - 3,
        size: FONT_SIZE,
        font,
        color: TEXT_COLOR,
      });
    } else {
      page.drawText('X', {
        x: xPos - 4,
        y: yPos - 4,
        size: 14,
        font,
        color: TEXT_COLOR,
      });
    }
  });

  const pdfBytes = await pdfDoc.save();
  return pdfBytes as unknown as Uint8Array;
};

/**
 * Print the Encuesta Medio Contraste directly
 */
export const printImagingEncuestaForm = async (
  patient: PatientData,
  requestingPhysician: string = '',
  marks: CustomMark[] = []
): Promise<void> => {
  const filledBytes = await fillImagingEncuestaForm(patient, requestingPhysician, marks);

  // 2. Reload to inject the print script securely
  const printDoc = await PDFDocument.load(filledBytes);
  injectPrintScript(printDoc);

  const finalBytes = await printDoc.save();
  const blob = new Blob([finalBytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);

  const newWindow = window.open(url, '_blank');
  if (!newWindow) {
    const link = document.createElement('a');
    link.href = url;
    link.download = `IMPRIMIR_Encuesta_${patient.patientName}.pdf`;
    link.click();
  }
};
