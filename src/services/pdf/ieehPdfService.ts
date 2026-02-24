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

// ── Template PDF path (loaded as asset via fetch) ──
const TEMPLATE_PATH = '/docs/estadistico-egreso.pdf';

// --- Constants ---
const FONT_SIZE = 9;
const FONT_SIZE_SMALL = 6;
const FONT_SIZE_CODE = 8;

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
}

/**
 * PDF coordinate mapping for each field.
 * Y coordinates are from the BOTTOM of the page (PDF standard).
 * Page height = 935.43, so top of page ≈ Y=935
 * To convert from "pixels from top" to PDF Y: pdfY = 935 - pixelsFromTop
 *
 * The form uses a grid layout. Coordinates estimated from the 609.57×935.43 page.
 */
const FIELD_COORDS = {
  // ── #4: NOMBRE LEGAL DEL PACIENTE ──  (✅ verified)
  primerApellido: { x: 85, y: 830, maxWidth: 160 },
  segundoApellido: { x: 255, y: 830, maxWidth: 160 },
  nombres: { x: 428, y: 830, maxWidth: 130 },

  // ── #52: NOMBRE SOCIAL ──  (✅ verified)
  nombreSocial: { x: 85, y: 800, maxWidth: 200 },

  // ── #5: TIPO DE IDENTIFICACIÓN + RUN ──
  tipoIdentificacion: { x: 170, y: 785, maxWidth: 15 },
  runDigits: { x: 85, y: 766, maxWidth: 200 },

  // ── #6: SEXO REGISTRAL ──  (✅ calibrated v5: X=385, Y=773)
  sexoRegistral: { x: 385, y: 773, maxWidth: 15 },

  // ── #7: FECHA DE NACIMIENTO ──  (corrected from dot cal: Y=800)
  nacDia: { x: 460, y: 800, maxWidth: 25 },
  nacMes: { x: 490, y: 800, maxWidth: 25 },
  nacAnio: { x: 520, y: 800, maxWidth: 35 },

  // ── #8: EDAD ──  (✅ verified)
  edad: { x: 105, y: 725, maxWidth: 50 },
  edadUnidad: { x: 185, y: 725, maxWidth: 15 },

  // ── #53→#10: PUEBLO INDÍGENA ──  (✅ calibrated v3: moved to correct section)
  puebloIndigena: { x: 525, y: 750, maxWidth: 15 },

  // ── #18: PREVISIÓN ──  (corrected from dot cal: X=60)
  prevision: { x: 60, y: 503, maxWidth: 15 },

  // ── #22: PROCEDENCIA ──
  procedencia: { x: 427, y: 453, maxWidth: 15 },

  // ── #24: INGRESO (hora, fecha) ──  (MAJOR FIX: X shifted ~130pt LEFT)
  // Dot calibration: hora=110, min=140, dd=190, mm=210, aa=230, Y=428
  ingresoHora: { x: 110, y: 428, maxWidth: 20 },
  ingresoMin: { x: 140, y: 428, maxWidth: 20 },
  ingresoDia: { x: 190, y: 428, maxWidth: 18 },
  ingresoMes: { x: 210, y: 428, maxWidth: 18 },
  ingresoAnio: { x: 230, y: 428, maxWidth: 30 },

  // ── #29: EGRESO (hora, fecha) ──  (✅ calibrated v3: Y 348→336)
  egresoHora: { x: 110, y: 336, maxWidth: 20 },
  egresoMin: { x: 140, y: 336, maxWidth: 20 },
  egresoDia: { x: 190, y: 336, maxWidth: 18 },
  egresoMes: { x: 210, y: 336, maxWidth: 18 },
  egresoAnio: { x: 230, y: 336, maxWidth: 30 },

  // ── #30: DÍAS DE ESTADA ──  (Y=328, previously had EGRESO here)
  diasEstada: { x: 110, y: 320, maxWidth: 55 },

  // ── #31: CONDICIÓN AL EGRESO ──
  condicionEgreso: { x: 230, y: 320, maxWidth: 15 },

  // ── #33: DIAGNÓSTICO PRINCIPAL ──  (Y corrected to 280 from dot cal)
  diagnosticoPrincipal: { x: 150, y: 280, maxWidth: 380 },
  codigoCIE10: { x: 548, y: 280, maxWidth: 55 },

  // ── #50: ESPECIALIDAD MÉDICO ──  (Y=82, above the doctor name boxes)
  especialidadMedico: { x: 430, y: 82, maxWidth: 170 },
} as const;

/**
 * Parse a date string in DD-MM-YYYY format
 */
const parseDate = (
  dateStr: string | undefined
): { dia: string; mes: string; anio: string } | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return { dia: parts[0], mes: parts[1], anio: parts[2] };
  }
  // Try YYYY-MM-DD
  if (parts.length === 3 && parts[0].length === 4) {
    return { dia: parts[2], mes: parts[1], anio: parts[0] };
  }
  return null;
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
 * Map insurance value to form number
 */
const mapInsurance = (insurance: string | undefined): string => {
  if (!insurance) return '';
  const map: Record<string, string> = {
    FONASA: '1',
    Fonasa: '1',
    ISAPRE: '2',
    Isapre: '2',
    CAPREDENA: '3',
    Capredena: '3',
    DIPRECA: '4',
    Dipreca: '4',
    SISA: '5',
    Particular: '96',
    'Sin Previsión': '96',
    Desconocido: '99',
  };
  return map[insurance] || '';
};

/**
 * Map sex to form number
 */
const mapSex = (sex: string | undefined): string => {
  if (!sex) return '';
  const map: Record<string, string> = {
    Femenino: 'F',
    Masculino: 'M',
    Indeterminado: 'I',
  };
  return map[sex] || '';
};

/**
 * Map admission origin to form number
 */
const mapProcedencia = (origin: string | undefined): string => {
  if (!origin) return '';
  const map: Record<string, string> = {
    Urgencia: '1',
    'Otra Procedencia': '2',
    'Atención especialidades': '3',
    'Cirugía Mayor Ambulatoria': '5',
  };
  return map[origin] || '';
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

    // Truncate if too wide
    let displayText = text;
    while (f.widthOfTextAtSize(displayText, fontSize) > coords.maxWidth && displayText.length > 1) {
      displayText = displayText.slice(0, -1);
    }

    page.drawText(displayText, {
      x: coords.x,
      y: coords.y,
      size: fontSize,
      font: f,
      color: TEXT_COLOR,
    });
  };

  // ── Fill fields ──

  // #4: NOMBRE LEGAL
  drawText(patient.lastName || '', FIELD_COORDS.primerApellido);
  drawText(patient.secondLastName || '', FIELD_COORDS.segundoApellido);
  drawText(patient.firstName || '', FIELD_COORDS.nombres);

  // If we don't have split name, use full patientName in primerApellido
  if (!patient.lastName && patient.patientName) {
    drawText(patient.patientName, FIELD_COORDS.primerApellido);
  }

  // #5: TIPO DE IDENTIFICACIÓN + RUN
  const tipoId = patient.documentType === 'RUT' ? '1' : '4'; // 1=RUN, 4=Pasaporte
  drawText(tipoId, FIELD_COORDS.tipoIdentificacion, { fontSize: FONT_SIZE_CODE });
  if (patient.rut) {
    drawText(patient.rut, FIELD_COORDS.runDigits, { fontSize: FONT_SIZE });
  }

  // #6: SEXO REGISTRAL
  const sexo = mapSex(patient.biologicalSex);
  drawText(sexo, FIELD_COORDS.sexoRegistral, { fontSize: FONT_SIZE_CODE, bold: true });

  // #7: FECHA DE NACIMIENTO
  const birthDate = parseDate(patient.birthDate);
  if (birthDate) {
    drawText(birthDate.dia, FIELD_COORDS.nacDia, { fontSize: FONT_SIZE_CODE });
    drawText(birthDate.mes, FIELD_COORDS.nacMes, { fontSize: FONT_SIZE_CODE });
    drawText(birthDate.anio, FIELD_COORDS.nacAnio, { fontSize: FONT_SIZE_CODE });
  }

  // #8: EDAD
  if (patient.age) {
    const ageNum = patient.age.replace(/\D/g, '');
    drawText(ageNum, FIELD_COORDS.edad, { fontSize: FONT_SIZE_CODE });
    // Unit: default to Años (1)
    drawText('1', FIELD_COORDS.edadUnidad, { fontSize: FONT_SIZE_CODE });
  }

  // #9: PUEBLO INDÍGENA
  if (patient.isRapanui) {
    drawText('1', FIELD_COORDS.puebloIndigena, { fontSize: FONT_SIZE_CODE }); // 1=Sí
  }

  // #18: PREVISIÓN
  const prevision = mapInsurance(patient.insurance);
  drawText(prevision, FIELD_COORDS.prevision, { fontSize: FONT_SIZE_CODE });

  // #22: PROCEDENCIA
  const procedencia = mapProcedencia(patient.admissionOrigin);
  drawText(procedencia, FIELD_COORDS.procedencia, { fontSize: FONT_SIZE_CODE });

  // #24: INGRESO
  const admDate = parseDate(patient.admissionDate);
  const admTime = parseTime(patient.admissionTime);
  if (admTime) {
    drawText(admTime.hora, FIELD_COORDS.ingresoHora, { fontSize: FONT_SIZE_CODE });
    drawText(admTime.min, FIELD_COORDS.ingresoMin, { fontSize: FONT_SIZE_CODE });
  }
  if (admDate) {
    drawText(admDate.dia, FIELD_COORDS.ingresoDia, { fontSize: FONT_SIZE_CODE });
    drawText(admDate.mes, FIELD_COORDS.ingresoMes, { fontSize: FONT_SIZE_CODE });
    drawText(admDate.anio, FIELD_COORDS.ingresoAnio, { fontSize: FONT_SIZE_CODE });
  }

  // #29: EGRESO
  const disDate = parseDate(discharge.dischargeDate);
  const disTime = parseTime(discharge.dischargeTime);
  if (disTime) {
    drawText(disTime.hora, FIELD_COORDS.egresoHora, { fontSize: FONT_SIZE_CODE });
    drawText(disTime.min, FIELD_COORDS.egresoMin, { fontSize: FONT_SIZE_CODE });
  }
  if (disDate) {
    drawText(disDate.dia, FIELD_COORDS.egresoDia, { fontSize: FONT_SIZE_CODE });
    drawText(disDate.mes, FIELD_COORDS.egresoMes, { fontSize: FONT_SIZE_CODE });
    drawText(disDate.anio, FIELD_COORDS.egresoAnio, { fontSize: FONT_SIZE_CODE });
  }

  // #30: DÍAS DE ESTADA
  const days =
    discharge.daysOfStay ?? calculateDaysOfStay(patient.admissionDate, discharge.dischargeDate);
  if (days > 0) {
    drawText(String(days), FIELD_COORDS.diasEstada, { fontSize: FONT_SIZE_CODE });
  }

  // #31: CONDICIÓN AL EGRESO (1=Vivo by default)
  drawText('1', FIELD_COORDS.condicionEgreso, { fontSize: FONT_SIZE_CODE });

  // #33: DIAGNÓSTICO PRINCIPAL + CIE-10
  const diagnostico = patient.cie10Description || patient.pathology || '';
  drawText(diagnostico, FIELD_COORDS.diagnosticoPrincipal, { fontSize: FONT_SIZE_SMALL });

  if (patient.cie10Code) {
    drawText(patient.cie10Code, FIELD_COORDS.codigoCIE10, { fontSize: FONT_SIZE_CODE, bold: true });
  }

  // #50: ESPECIALIDAD
  const specialtyStr = String(patient.specialty || '');
  if (specialtyStr && specialtyStr !== 'Vacío' && specialtyStr !== '') {
    drawText(specialtyStr, FIELD_COORDS.especialidadMedico, { fontSize: FONT_SIZE });
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

  // Create download link
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  const patientName = patient.patientName || 'paciente';
  const safeName = patientName
    .replace(/[^a-zA-ZáéíóúñÁÉÍÓÚÑ\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  link.href = url;
  link.download = `IEEH_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
