/**
 * IEEH PDF Service — Llenado Automático del Informe Estadístico de Egreso Hospitalario
 *
 * Genera un PDF llenado a partir de la plantilla docs/estadistico-egreso.pdf,
 * escribiendo texto sobre las posiciones exactas del formulario oficial del MINSAL.
 *
 * DIMENSIONES DEL PDF:
 *  - 609.57 × 935.43 puntos (oficio chileno: 215 × 330mm)
 *  - Coordenadas PDF: origen en esquina INFERIOR-IZQUIERDA
 *  - Y invertido respecto a la pantalla: Y=935 es el borde superior
 *
 * CAMPOS DISPONIBLES PARA LLENADO (Fase 1):
 *  #4  Nombre legal (Primer Apellido, Segundo Apellido, Nombres)
 *  #5  Tipo identificación + RUN
 *  #6  Sexo registral
 *  #7  Fecha de nacimiento (Día, Mes, Año)
 *  #8  Edad + Unidad
 *  #10 Pueblo indígena (Rapanui) — Sección PUEBLOS INDÍGENAS
 *  #18 Previsión
 *  #22 Procedencia del paciente
 *  #24 Ingreso (hora, fecha)
 *  #29 Egreso (hora, fecha) — del movimiento de alta
 *  #30 Días de estada — calculado
 *  #33 Diagnóstico principal + Código CIE-10
 *  Especialidad del médico tratante
 *
 * ÚLTIMA CALIBRACIÓN: 2026-02-23 (v5, 5 iteraciones visuales con verifyPdfCoords.cjs)
 * TEST DE GOBERNANZA: src/tests/services/pdf/ieehPdfCoordinates.test.ts
 */

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PatientData } from '@/types';
import { splitPatientName, calculateAge, formatDateToCL } from '@/utils/clinicalUtils';
import { saveAndDownloadPdf } from './pdfBase';
import { FIELD_COORDS, mapInsurance, mapSex, mapProcedencia } from './ieehPdfCoordinates';

// ── Template PDF path (loaded as asset via fetch) ──
const TEMPLATE_PATH = '/docs/estadistico-egreso.pdf';

// --- Constants ---
const FONT_SIZE = 12; // Uniform size for all fields (20% larger than original 10pt)
const CHAR_SPACING = 1; // Extra spacing between characters for form legibility

// ── Color for filled text (dark black) ──
const TEXT_COLOR = rgb(0, 0, 0);

/**
 * Data needed beyond PatientData for discharge-specific fields
 */
export interface DischargeFormData {
  dischargeDate?: string; // DD-MM-YYYY
  dischargeTime?: string; // HH:MM
  destination?: string; // Destino al alta
  daysOfStay?: number; // Días de estada (auto-calculated if not provided)
  establishmentName?: string;
  establishmentCode?: string;
  // ── Dialog-provided overrides ──
  diagnosticoPrincipal?: string; // Free-text diagnosis (overrides patient data)
  cie10Code?: string; // CIE-10 code (overrides patient data)
  condicionEgreso?: string; // 1-7 condition code
  intervencionQuirurgica?: string; // Surgery code number
  intervencionQuirurgDescrip?: string; // Surgery description
  procedimiento?: string; // Procedure code number
  procedimientoDescrip?: string; // Procedure description
  tratanteApellido1?: string;
  tratanteApellido2?: string;
  tratanteNombre?: string;
  tratanteRut?: string;
}

/**
 * Parse a date string in DD-MM-YYYY or YYYY-MM-DD format
 */
const parseDate = (
  dateStr: string | undefined
): { dia: string; mes: string; anio: string } | null => {
  if (!dateStr) return null;
  const normalized = formatDateToCL(dateStr);
  const parts = normalized.split('-');
  if (parts.length !== 3) return null;
  return { dia: parts[0], mes: parts[1], anio: parts[2] };
};

/**
 * Parse time string in HH:MM format
 */
const parseTime = (timeStr: string | undefined): { hora: string; min: string } | null => {
  if (!timeStr) return null;
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    return { hora: parts[0], min: parts[1] };
  }
  return null;
};

/**
 * Calculate days between two dates
 */
const calculateDaysOfStay = (
  admissionDate: string | undefined,
  dischargeDate: string | undefined
): number => {
  if (!admissionDate || !dischargeDate) return 0;
  try {
    // Parse DD-MM-YYYY
    const parseD = (d: string) => {
      const parts = d.split('-');
      if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1]}-${parts[2]}`);
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    };
    const adm = parseD(admissionDate);
    const dis = parseD(dischargeDate);
    const diff = Math.ceil((dis.getTime() - adm.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(diff, 1); // Mínimo 1 día
  } catch {
    return 0;
  }
};

/**
 * Main function: Fill the IEEH form with patient data
 *
 * @param patient - Patient data from the census
 * @param discharge - Additional discharge-specific data
 * @returns Uint8Array of the filled PDF ready for download
 */
export const fillIEEHForm = async (
  patient: PatientData,
  discharge: DischargeFormData = {}
): Promise<Uint8Array> => {
  // 1. Load the template PDF
  const templateResponse = await fetch(TEMPLATE_PATH);
  const templateBytes = await templateResponse.arrayBuffer();
  const pdfDoc = await PDFDocument.load(templateBytes);

  // 2. Embed font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // 3. Get page 1
  const page = pdfDoc.getPage(0);

  // Helper: draw text at coordinates
  const drawText = (
    text: string,
    coords: { x: number; y: number; maxWidth: number },
    options: { fontSize?: number; bold?: boolean } = {}
  ) => {
    if (!text) return;
    const fontSize = options.fontSize ?? FONT_SIZE;
    const f = options.bold ? fontBold : font;

    // Force uppercase for all form text
    const displayText = text.toUpperCase();

    // Draw each character individually with extra spacing for legibility
    let xOffset = coords.x;
    for (const char of displayText) {
      page.drawText(char, {
        x: xOffset,
        y: coords.y,
        size: fontSize,
        font: f,
        color: TEXT_COLOR,
      });
      xOffset += f.widthOfTextAtSize(char, fontSize) + CHAR_SPACING;
    }
  };

  // ── Fill fields ──

  // #4: NOMBRE LEGAL
  const [nombres, primerApellido, segundoApellido] = splitPatientName(patient.patientName);
  drawText(primerApellido, FIELD_COORDS.primerApellido);
  drawText(segundoApellido, FIELD_COORDS.segundoApellido);
  drawText(nombres, FIELD_COORDS.nombres);

  // #5: TIPO DE IDENTIFICACIÓN + RUN
  const tipoId = patient.documentType === 'RUT' ? '1' : '4'; // 1=RUN, 4=Pasaporte
  drawText(tipoId, FIELD_COORDS.tipoIdentificacion);
  if (patient.rut) {
    drawText(patient.rut, FIELD_COORDS.runDigits);
  }

  // #6: SEXO REGISTRAL
  const sexo = mapSex(patient.biologicalSex);
  drawText(sexo, FIELD_COORDS.sexoRegistral, { bold: true });

  // #7: FECHA DE NACIMIENTO
  const birthDate = parseDate(patient.birthDate);
  if (birthDate) {
    drawText(birthDate.dia, FIELD_COORDS.nacDia);
    drawText(birthDate.mes, FIELD_COORDS.nacMes);
    drawText(birthDate.anio, FIELD_COORDS.nacAnio);
  }

  // #8: EDAD
  const ageStr = calculateAge(patient.birthDate);
  if (ageStr) {
    const ageNum = ageStr.replace(/\D/g, '');
    drawText(ageNum, FIELD_COORDS.edad);
    // Unit: default to Años (1)
    drawText('1', FIELD_COORDS.edadUnidad);
  }

  // #9: PUEBLO INDÍGENA
  if (patient.isRapanui) {
    drawText('3', FIELD_COORDS.puebloIndigena); // 3=Rapa Nui
  }

  // #18: PREVISIÓN
  const prevision = mapInsurance(patient.insurance);
  drawText(prevision, FIELD_COORDS.prevision);

  // #22: PROCEDENCIA
  const procedencia = mapProcedencia(patient.admissionOrigin);
  drawText(procedencia, FIELD_COORDS.procedencia);

  // #24: INGRESO
  const admDate = parseDate(patient.admissionDate);
  const admTime = parseTime(patient.admissionTime);
  if (admTime) {
    drawText(admTime.hora, FIELD_COORDS.ingresoHora);
    drawText(admTime.min, FIELD_COORDS.ingresoMin);
  }
  if (admDate) {
    drawText(admDate.dia, FIELD_COORDS.ingresoDia);
    drawText(admDate.mes, FIELD_COORDS.ingresoMes);
    drawText(admDate.anio, FIELD_COORDS.ingresoAnio);
  }

  // #29: EGRESO
  const disDate = parseDate(discharge.dischargeDate);
  const disTime = parseTime(discharge.dischargeTime);
  if (disTime) {
    drawText(disTime.hora, FIELD_COORDS.egresoHora);
    drawText(disTime.min, FIELD_COORDS.egresoMin);
  }
  if (disDate) {
    drawText(disDate.dia, FIELD_COORDS.egresoDia);
    drawText(disDate.mes, FIELD_COORDS.egresoMes);
    drawText(disDate.anio, FIELD_COORDS.egresoAnio);
  }

  // #30: DÍAS DE ESTADA
  const days =
    discharge.daysOfStay ?? calculateDaysOfStay(patient.admissionDate, discharge.dischargeDate);
  if (days > 0) {
    drawText(String(days), FIELD_COORDS.diasEstada);
  }

  // #31: CONDICIÓN AL EGRESO (1-7, dialog override or default 1=Domicilio)
  drawText(discharge.condicionEgreso || '1', FIELD_COORDS.condicionEgreso);
  if (discharge.destination) {
    drawText(discharge.destination, FIELD_COORDS.destinoAlAlta);
  }

  // #33: DIAGNÓSTICO PRINCIPAL + CIE-10
  // Dialog overrides take priority over patient data
  const diagnostico =
    discharge.diagnosticoPrincipal || patient.cie10Description || patient.pathology || '';
  drawText(diagnostico, FIELD_COORDS.diagnosticoPrincipal);

  const cie10 = discharge.cie10Code || patient.cie10Code || '';
  if (cie10) {
    drawText(cie10, FIELD_COORDS.codigoCIE10, { bold: true });
  }

  // #39: INTERVENCIÓN QUIRÚRGICA
  if (discharge.intervencionQuirurgica) {
    drawText(discharge.intervencionQuirurgica, FIELD_COORDS.intervencionQuirurgica);
  }
  if (discharge.intervencionQuirurgDescrip) {
    drawText(discharge.intervencionQuirurgDescrip, FIELD_COORDS.intervencionQuirurgDescrip);
  }

  // #42: PROCEDIMIENTO
  if (discharge.procedimiento) {
    drawText(discharge.procedimiento, FIELD_COORDS.procedimiento);
  }
  if (discharge.procedimientoDescrip) {
    drawText(discharge.procedimientoDescrip, FIELD_COORDS.procedimientoDescrip);
  }

  // #49: MÉDICO TRATANTE
  if (discharge.tratanteApellido1) {
    drawText(discharge.tratanteApellido1, FIELD_COORDS.tratanteApellido1);
  }
  if (discharge.tratanteApellido2) {
    drawText(discharge.tratanteApellido2, FIELD_COORDS.tratanteApellido2);
  }
  if (discharge.tratanteNombre) {
    drawText(discharge.tratanteNombre, FIELD_COORDS.tratanteNombre);
  }
  if (discharge.tratanteRut) {
    drawText(discharge.tratanteRut, FIELD_COORDS.tratanteRut);
  }

  // #50: ESPECIALIDAD
  const specialtyStr = String(patient.specialty || '');
  if (specialtyStr && specialtyStr !== 'Vacío' && specialtyStr !== '') {
    drawText(specialtyStr, FIELD_COORDS.especialidadMedico);
  }

  // 4. Serialize and return
  const filledPdf = await pdfDoc.save();
  return filledPdf;
};

/**
 * Generate and trigger download of the filled IEEH form
 */
export const downloadIEEHForm = async (
  patient: PatientData,
  discharge: DischargeFormData = {}
): Promise<void> => {
  const pdfBytes = await fillIEEHForm(patient, discharge);

  const patientName = patient.patientName || 'paciente';
  const safeName = patientName
    .replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const suggestedName = `IEEH_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;

  await saveAndDownloadPdf(pdfBytes, suggestedName);
};

/**
 * Open filled IEEH form in a new browser tab for preview
 */
export const previewIEEHForm = async (
  patient: PatientData,
  discharge: DischargeFormData = {}
): Promise<void> => {
  const pdfBytes = await fillIEEHForm(patient, discharge);
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};
