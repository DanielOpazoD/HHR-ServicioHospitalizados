import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import {
  HospitalConfig,
  QuestionnaireResponse,
  TransferPatientData,
  GeneratedDocument,
} from '@/types/transferDocuments';
import {
  formatDate,
  getCurrentDate,
  createOfficialHeader,
  calculateAge,
  getResponse,
} from './documentGeneratorUtils';
import { createGeneratedDocument } from './transferGeneratedDocumentController';
import { createTransferDocxSection } from './transferDocxSectionFactory';
import { createTransferDocxTable, type TransferTableRowInput } from './transferDocxTableController';
import { populateTransferIaasWorkbook } from './transferIaasWorkbookController';

const loadCreateWorkbook = async () =>
  import('@/services/exporters/excelUtils').then(module => module.createWorkbook);

const packDocxDocument = async (
  templateId: string,
  displayName: string,
  patientName: string,
  doc: Document
): Promise<GeneratedDocument> => {
  const blob = await Packer.toBlob(doc);
  return createGeneratedDocument(
    templateId,
    displayName,
    patientName,
    'docx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    blob
  );
};

const table = (...rows: TransferTableRowInput[]) => createTransferDocxTable(rows);

export const generateTapaTraslado = async (
  patientData: TransferPatientData,
  hospital: HospitalConfig
): Promise<GeneratedDocument> => {
  const doc = new Document({
    sections: [
      createTransferDocxSection([
        createOfficialHeader('TRASLADO DE PACIENTE'),
        new Paragraph({
          children: [
            new TextRun({
              text: `HOSPITAL DE DESTINO: ${hospital.name.toUpperCase()}`,
              bold: true,
              size: 28,
            }),
          ],
          alignment: 'center',
          spacing: { after: 400 },
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          children: [new TextRun({ text: '1. IDENTIFICACIÓN DEL PACIENTE', bold: true, size: 24 })],
          spacing: { before: 400, after: 200 },
        }),
        table(
          ['Nombre Completo', patientData.patientName],
          ['RUT / RUN', patientData.rut],
          ['Fecha Nacimiento', formatDate(patientData.birthDate)],
          ['Diagnóstico Ingreso', patientData.diagnosis || '-'],
          ['Servicio / Cama Origen', `${patientData.originHospital} - ${patientData.bedName}`]
        ),
        new Paragraph({
          children: [
            new TextRun({
              text: `\nFecha de Emisión: ${getCurrentDate()}`,
              italics: true,
              size: 18,
            }),
          ],
          alignment: 'right',
          spacing: { before: 600 },
        }),
      ]),
    ],
  });

  return packDocxDocument('tapa-traslado', 'Tapa_Traslado', patientData.patientName, doc);
};

export const generateEncuestaCovid = async (
  patientData: TransferPatientData,
  responses: QuestionnaireResponse,
  _hospital: HospitalConfig
): Promise<GeneratedDocument> => {
  const doc = new Document({
    sections: [
      createTransferDocxSection([
        createOfficialHeader('ENCUESTA EPIDEMIOLÓGICA COVID-19'),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'I. IDENTIFICACIÓN', bold: true, size: 24 })],
          spacing: { after: 200 },
        }),
        table(['NOMBRE COMPLETO', patientData.patientName], ['RUN / PASAPORTE', patientData.rut]),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({ text: 'II. ANTECEDENTES EPIDEMIOLÓGICOS', bold: true, size: 24 }),
          ],
          spacing: { before: 400, after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: '1. ¿Ha estado en contacto con persona COVID+ en últimas 48hrs?',
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `RESPUESTA: ${getResponse(responses, 'contactoCovid')}`,
              color: '2563EB',
            }),
          ],
          spacing: { after: 200 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: '2. ¿Presenta alguno de estos síntomas (Fiebre, tos, mialgia, disnea)?',
              bold: true,
            }),
          ],
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `RESPUESTA: ${getResponse(responses, 'sintomasCovid') || 'NINGUNO'}`,
              color: '2563EB',
            }),
          ],
          spacing: { after: 400 },
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [
            new TextRun({ text: 'III. RESPONSABLE DE LA ENCUESTA', bold: true, size: 24 }),
          ],
          spacing: { after: 200 },
        }),
        table(
          ['NOMBRE RESPONSABLE', getResponse(responses, 'responsableEncuesta')],
          ['CARGO / FUNCIÓN', getResponse(responses, 'cargoResponsable')],
          ['FECHA', getCurrentDate()]
        ),
      ]),
    ],
  });

  return packDocxDocument('encuesta-covid', 'Encuesta_COVID', patientData.patientName, doc);
};

export const generateSolicitudCamaHDS = async (
  patientData: TransferPatientData,
  responses: QuestionnaireResponse,
  _hospital: HospitalConfig
): Promise<GeneratedDocument> => {
  const doc = new Document({
    sections: [
      createTransferDocxSection([
        createOfficialHeader('SOLICITUD DE CAMA HOSPITALARIA'),
        new Paragraph({
          children: [
            new TextRun({ text: 'Santiago, ', size: 22 }),
            new TextRun({ text: getCurrentDate(), underline: {}, size: 22 }),
          ],
          alignment: 'right',
          spacing: { after: 300 },
        }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: '1. ANTECEDENTES DEL PACIENTE', bold: true, size: 24 })],
          spacing: { after: 200 },
        }),
        table(
          ['Nombre Completo', patientData.patientName],
          ['RUT / Cédula', patientData.rut],
          ['Edad', String(calculateAge(patientData.birthDate))],
          ['Previsión', 'FONASA / Isapre'],
          ['Diagnóstico', patientData.diagnosis || '-'],
          [
            'Motivo Transferencia',
            getResponse(responses, 'observaciones') || 'Continuidad de cuidados',
          ]
        ),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: '2. ANTECEDENTES DE ORIGEN', bold: true, size: 24 })],
          spacing: { before: 400, after: 200 },
        }),
        table(
          ['Centro Derivador', patientData.originHospital],
          ['Médico Solicitante', getResponse(responses, 'medicoTratante')],
          ['Especialidad Requerida', 'Medicina Interna / Cirugía']
        ),
        new Paragraph({
          children: [
            new TextRun({ text: '\n\n\n__________________________', bold: true }),
            new TextRun({ text: '\nFirma y Timbre Médico Solicitante', size: 18 }),
          ],
          alignment: 'center',
          spacing: { before: 800 },
        }),
      ]),
    ],
  });

  return packDocxDocument('solicitud-cama-hds', 'Solicitud_Cama_HDS', patientData.patientName, doc);
};

export const generateSolicitudAmbulancia = async (
  patientData: TransferPatientData,
  responses: QuestionnaireResponse,
  _hospital: HospitalConfig
): Promise<GeneratedDocument> => {
  const doc = new Document({
    sections: [
      createTransferDocxSection([
        createOfficialHeader('SOLICITUD DE TRASLADO / MOVILIZACIÓN'),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: '1. IDENTIFICACIÓN', bold: true, size: 24 })],
          spacing: { after: 200 },
        }),
        table(
          ['Nombre Paciente', patientData.patientName],
          ['Rut', patientData.rut],
          ['Diagnóstico', patientData.diagnosis || '-'],
          ['Médico Tratante', getResponse(responses, 'medicoTratante')]
        ),
        ...processConditionSection(responses),
        ...processItinerarySection(responses),
        new Paragraph({
          children: [
            new TextRun({
              text: `\n\nEnfermera/o Responsable: ${getResponse(responses, 'enfermeraResponsable')}`,
              bold: true,
            }),
            new TextRun({ text: `\n${patientData.originHospital}` }),
          ],
          spacing: { before: 600 },
        }),
      ]),
    ],
  });

  return packDocxDocument(
    'solicitud-ambulancia',
    'Solicitud_Ambulancia',
    patientData.patientName,
    doc
  );
};

const processConditionSection = (responses: QuestionnaireResponse) => {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: '2. CONDICIONES CLÍNICAS', bold: true, size: 24 })],
      spacing: { before: 400, after: 200 },
    }),
    table(
      ['Posición Traslado', getResponse(responses, 'posicionTraslado')],
      ['Acompañante HHR', getResponse(responses, 'requiereAcompanante')],
      ['Oxígeno / Soporte', getResponse(responses, 'requiereOxigeno')],
      ['Observaciones', getResponse(responses, 'otrasCondiciones') || '-']
    ),
  ];
};

const processItinerarySection = (responses: QuestionnaireResponse) => {
  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: '3. ITINERARIO DE TRASLADO', bold: true, size: 24 })],
      spacing: { before: 400, after: 200 },
    }),
    table(
      ['Línea Aérea / Empresa', getResponse(responses, 'lineaAerea')],
      ['Número de Vuelo / Móvil', getResponse(responses, 'numeroVuelo')],
      ['ETD (Salida)', getResponse(responses, 'horaDespegue')],
      ['ETA (Llegada)', getResponse(responses, 'horaArribo')]
    ),
  ];
};

export const generateFormularioIAAS = async (
  patientData: TransferPatientData,
  responses: QuestionnaireResponse,
  _hospital: HospitalConfig
): Promise<GeneratedDocument> => {
  const createWorkbook = await loadCreateWorkbook();
  const workbook = await createWorkbook();
  populateTransferIaasWorkbook(workbook, patientData, responses);

  const buffer = await workbook.xlsx.writeBuffer();
  return createGeneratedDocument(
    'formulario-iaas',
    'Formulario_IAAS',
    patientData.patientName,
    'xlsx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
  );
};
