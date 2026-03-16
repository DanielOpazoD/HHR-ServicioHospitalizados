/**
 * Imaging Request PDF Service — Solicitud de Imágenes
 *
 * Fills the official imaging request form template with patient data
 * using coordinate-based text injection (same pattern as ieehPdfService).
 *
 * COORDINATES SOURCE: User-provided JSON from PDF field mapping tool.
 * Template: public/docs/solicitud-imagen.pdf
 */

import { PatientData } from '@/types/domain/patient';
import {
  splitPatientName,
  calculateAge,
  formatDateToCL as formatDate,
} from '@/utils/clinicalUtils';
import { saveAndDownloadPdf } from './pdfBase';
import {
  SOLICITUD_FIELD_COORDS,
  ENCUESTA_FIELD_COORDS,
  CONSENTIMIENTO_FIELD_COORDS,
} from './imagingRequestPdfCoordinates';
import type { CustomMark } from './pdfMarkTypes';
import {
  buildSuggestedPdfName,
  createUppercaseTextDrawer,
  drawCustomMarks,
  embedHelvetica,
  getTodayFormatted,
  injectPrintScriptAndOpen,
  loadPdfTemplate,
  createPdfObjectUrl,
} from './pdfBrowserUtils';

// Re-export constants for backwards compatibility and tests
export { SOLICITUD_FIELD_COORDS, ENCUESTA_FIELD_COORDS, CONSENTIMIENTO_FIELD_COORDS };
export type { CustomMark } from './pdfMarkTypes';

// ── Template PDF paths ──
export const SOLICITUD_TEMPLATE_PATH = '/docs/solicitud-imagen.pdf';
export const ENCUESTA_TEMPLATE_PATH = '/docs/encuesta-contraste.pdf';
export const CONSENTIMIENTO_TEMPLATE_PATH = '/docs/consentimiento.pdf';

const FONT_SIZE = 10;

const getDiagnosisValue = (patient: PatientData): string =>
  patient.pathology || patient.cie10Description || '';

const fillImagingPatientIdentity = ({
  drawText,
  patient,
  coords,
  includeBirthDate,
}: {
  drawText: (text: string, coords: { x: number; y: number; maxWidth: number }) => void;
  patient: PatientData;
  coords: Record<string, { x: number; y: number; maxWidth: number }>;
  includeBirthDate?: boolean;
}) => {
  const [nombres, primerApellido, segundoApellido] = splitPatientName(patient.patientName);

  drawText(nombres, coords.nombres);
  drawText(primerApellido, coords.primerApellido);
  drawText(segundoApellido, coords.segundoApellido);
  drawText(patient.rut || '', coords.rut);
  drawText(calculateAge(patient.birthDate), coords.edad);

  if (includeBirthDate && 'fechaNacimiento' in coords) {
    drawText(formatDate(patient.birthDate), coords.fechaNacimiento);
  }
};

const fillPhysicianAndDiagnosis = ({
  drawText,
  patient,
  requestingPhysician,
  coords,
  includeDateField,
}: {
  drawText: (text: string, coords: { x: number; y: number; maxWidth: number }) => void;
  patient: PatientData;
  requestingPhysician: string;
  coords: Record<string, { x: number; y: number; maxWidth: number }>;
  includeDateField?: string;
}) => {
  drawText(getDiagnosisValue(patient), coords.diagnostico);

  if (includeDateField) {
    drawText(getTodayFormatted(), coords[includeDateField]);
  }

  if (requestingPhysician) {
    drawText(requestingPhysician, coords.medicoTratante);
  }
};

/**
 * Fill the imaging request form with patient data
 */
export const fillImagingRequestForm = async (
  patient: PatientData,
  requestingPhysician: string = '',
  marks: CustomMark[] = []
): Promise<Uint8Array> => {
  const pdfDoc = await loadPdfTemplate(SOLICITUD_TEMPLATE_PATH);
  const font = await embedHelvetica(pdfDoc);
  const page = pdfDoc.getPage(0);
  const drawText = createUppercaseTextDrawer({ page, font, fontSize: FONT_SIZE });

  fillImagingPatientIdentity({
    drawText,
    patient,
    coords: SOLICITUD_FIELD_COORDS,
    includeBirthDate: true,
  });
  fillPhysicianAndDiagnosis({
    drawText,
    patient,
    requestingPhysician,
    coords: SOLICITUD_FIELD_COORDS,
    includeDateField: 'fechaSolicitud',
  });
  drawCustomMarks({ page, font, marks, fontSize: FONT_SIZE });

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
  const pdfDoc = await loadPdfTemplate(CONSENTIMIENTO_TEMPLATE_PATH);
  const font = await embedHelvetica(pdfDoc);
  const page = pdfDoc.getPage(0);
  const drawText = createUppercaseTextDrawer({ page, font, fontSize: FONT_SIZE });

  fillImagingPatientIdentity({
    drawText,
    patient,
    coords: CONSENTIMIENTO_FIELD_COORDS,
  });
  fillPhysicianAndDiagnosis({
    drawText,
    patient,
    requestingPhysician,
    coords: CONSENTIMIENTO_FIELD_COORDS,
    includeDateField: 'fecha',
  });
  drawCustomMarks({ page, font, marks, fontSize: FONT_SIZE });

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
  const suggestedName = buildSuggestedPdfName('SolicitudImagen', patient.patientName || 'paciente');

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
  return createPdfObjectUrl(pdfBytes);
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
  const filledBytes = await fillImagingRequestForm(patient, requestingPhysician, marks);
  await injectPrintScriptAndOpen({
    filledBytes,
    fileName: `IMPRIMIR_Solicitud_${patient.patientName}.pdf`,
  });
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
  await injectPrintScriptAndOpen({
    filledBytes,
    fileName: `IMPRIMIR_Consentimiento_${patient.patientName}.pdf`,
  });
};

/**
 * Fill the Encuesta Medio Contraste form with patient data
 */
export const fillImagingEncuestaForm = async (
  patient: PatientData,
  requestingPhysician: string = '',
  marks: CustomMark[] = []
): Promise<Uint8Array> => {
  const pdfDoc = await loadPdfTemplate(ENCUESTA_TEMPLATE_PATH);
  const font = await embedHelvetica(pdfDoc);
  const page = pdfDoc.getPage(0);
  const drawText = createUppercaseTextDrawer({ page, font, fontSize: FONT_SIZE });

  fillImagingPatientIdentity({
    drawText,
    patient,
    coords: ENCUESTA_FIELD_COORDS,
    includeBirthDate: true,
  });
  fillPhysicianAndDiagnosis({
    drawText,
    patient,
    requestingPhysician,
    coords: ENCUESTA_FIELD_COORDS,
  });
  drawCustomMarks({ page, font, marks, fontSize: FONT_SIZE });

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
  await injectPrintScriptAndOpen({
    filledBytes,
    fileName: `IMPRIMIR_Encuesta_${patient.patientName}.pdf`,
  });
};
