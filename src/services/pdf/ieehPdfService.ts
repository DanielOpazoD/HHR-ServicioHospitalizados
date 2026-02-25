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
}

/**
 * PDF coordinate mapping for each field.
 * Y coordinates are from the BOTTOM of the page (PDF standard).
 * Page height = 935.43, so top of page ≈ Y=935
 *
 * COORDINATES SOURCE: Extracted via PDF field mapping tool (2026-02-23).
 * These replace the manually calibrated values from visual inspection.
 */
const FIELD_COORDS = {
  // ── #4: NOMBRE LEGAL DEL PACIENTE ── (Y=826.52)
  primerApellido: { x: 50.84, y: 826.52, maxWidth: 137.82 },
  segundoApellido: { x: 237.8, y: 826.52, maxWidth: 118.68 },
  nombres: { x: 441.64, y: 826.52, maxWidth: 110.58 },

  // ── #52: NOMBRE SOCIAL ──
  nombreSocial: { x: 114.24, y: 804.28, maxWidth: 93.63 },

  // ── #5: TIPO DE IDENTIFICACIÓN + RUN ──
  tipoIdentificacion: { x: 111.31, y: 782.21, maxWidth: 11.03 },
  runDigits: { x: 56.99, y: 759.19, maxWidth: 87.72 },

  // ── #6: SEXO REGISTRAL ──
  sexoRegistral: { x: 305.82, y: 781.46, maxWidth: 11.76 },

  // ── #7: FECHA DE NACIMIENTO ── (Y=800.54)
  nacDia: { x: 450.35, y: 800.54, maxWidth: 22.86 },
  nacMes: { x: 489.42, y: 800.54, maxWidth: 21.4 },
  nacAnio: { x: 524.05, y: 800.54, maxWidth: 50.84 },

  // ── #8: EDAD ──
  edad: { x: 79, y: 722.06, maxWidth: 35.36 },
  edadUnidad: { x: 181.04, y: 720.09, maxWidth: 10.67 },

  // ── #10: PUEBLO INDÍGENA ──
  puebloIndigena: { x: 523.86, y: 750.12, maxWidth: 22.68 },

  // ── #18: PREVISIÓN ──
  prevision: { x: 54.37, y: 516.73, maxWidth: 10.67 },

  // ── #22: PROCEDENCIA ──
  procedencia: { x: 225.78, y: 471.36, maxWidth: 10.67 },

  // ── #24: INGRESO (hora, fecha) ── (Y=428.74)
  ingresoHora: { x: 102.35, y: 428.74, maxWidth: 22.68 },
  ingresoMin: { x: 136.36, y: 428.74, maxWidth: 21.33 },
  ingresoDia: { x: 181.71, y: 428.74, maxWidth: 22.68 },
  ingresoMes: { x: 215.73, y: 428.74, maxWidth: 23.35 },
  ingresoAnio: { x: 249.74, y: 428.74, maxWidth: 22.01 },

  // ── #29: EGRESO (hora, fecha) ── (Y=341.43)
  egresoHora: { x: 91.68, y: 341.43, maxWidth: 21.33 },
  egresoMin: { x: 124.35, y: 341.43, maxWidth: 23.35 },
  egresoDia: { x: 169.03, y: 341.43, maxWidth: 22.68 },
  egresoMes: { x: 204.39, y: 341.43, maxWidth: 23.35 },
  egresoAnio: { x: 238.4, y: 341.43, maxWidth: 24.02 },

  // ── #30: DÍAS DE ESTADA ── (Y=326.75)
  diasEstada: { x: 103.69, y: 326.75, maxWidth: 45.35 },

  // ── #31: CONDICIÓN AL EGRESO ── (Y=326.75)
  condicionEgreso: { x: 250.41, y: 326.75, maxWidth: 11.34 },

  // ── #33: DIAGNÓSTICO PRINCIPAL ──
  diagnosticoPrincipal: { x: 167.08, y: 280.72, maxWidth: 341.48 },
  codigoCIE10: { x: 529.23, y: 281.38, maxWidth: 46.69 },

  // ── #50: ESPECIALIDAD MÉDICO ──
  especialidadMedico: { x: 327.77, y: 76.61, maxWidth: 151.42 },
} as const;

/**
 * Parse a date string in DD-MM-YYYY format
 */
const parseDate = (
  dateStr: string | undefined
): { dia: string; mes: string; anio: string } | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;

  // YYYY-MM-DD format (year first)
  if (parts[0].length === 4) {
    return { dia: parts[2], mes: parts[1], anio: parts[0] };
  }

  // DD-MM-YYYY format (day first)
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
  drawText(patient.lastName || '', FIELD_COORDS.primerApellido);
  drawText(patient.secondLastName || '', FIELD_COORDS.segundoApellido);
  drawText(patient.firstName || '', FIELD_COORDS.nombres);

  // If we don't have split name, use full patientName in primerApellido
  if (!patient.lastName && patient.patientName) {
    drawText(patient.patientName, FIELD_COORDS.primerApellido);
  }

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
  if (patient.age) {
    const ageNum = patient.age.replace(/\D/g, '');
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

  // #31: CONDICIÓN AL EGRESO (1=Vivo by default)
  drawText('1', FIELD_COORDS.condicionEgreso);

  // #33: DIAGNÓSTICO PRINCIPAL + CIE-10
  const diagnostico = patient.cie10Description || patient.pathology || '';
  drawText(diagnostico, FIELD_COORDS.diagnosticoPrincipal);

  if (patient.cie10Code) {
    drawText(patient.cie10Code, FIELD_COORDS.codigoCIE10, { bold: true });
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

  // Try native Save As dialog (File System Access API)
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (
        window as unknown as {
          showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'PDF Document',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(new Uint8Array(pdfBytes));
      await writable.close();
      return;
    } catch (err) {
      // User cancelled the dialog — do nothing
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // Fallback to classic download on other errors
    }
  }

  // Fallback: classic download link
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
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
