import type {
  GeneratedDocument,
  HospitalConfig,
  QuestionnaireResponse,
  TransferPatientData,
} from '@/types/transferDocuments';

export type TransferFallbackGenerator = (
  patientData: TransferPatientData,
  responses: QuestionnaireResponse,
  hospital: HospitalConfig
) => Promise<GeneratedDocument>;

type DocumentFallbacksModule = typeof import('./documentFallbacks');

let documentFallbacksModulePromise: Promise<DocumentFallbacksModule> | null = null;

const loadDocumentFallbacksModule = async (): Promise<DocumentFallbacksModule> => {
  if (!documentFallbacksModulePromise) {
    documentFallbacksModulePromise = import('./documentFallbacks');
  }

  return documentFallbacksModulePromise;
};

const TRANSFER_FALLBACK_REGISTRY: Record<string, TransferFallbackGenerator> = {
  'tapa-traslado': async (patientData, _responses, hospital) => {
    const module = await loadDocumentFallbacksModule();
    return module.generateTapaTraslado(patientData, hospital);
  },
  'encuesta-covid': async (patientData, responses, hospital) => {
    const module = await loadDocumentFallbacksModule();
    return module.generateEncuestaCovid(patientData, responses, hospital);
  },
  'solicitud-cama-hds': async (patientData, responses, hospital) => {
    const module = await loadDocumentFallbacksModule();
    return module.generateSolicitudCamaHDS(patientData, responses, hospital);
  },
  'solicitud-ambulancia': async (patientData, responses, hospital) => {
    const module = await loadDocumentFallbacksModule();
    return module.generateSolicitudAmbulancia(patientData, responses, hospital);
  },
  'formulario-iaas': async (patientData, responses, hospital) => {
    const module = await loadDocumentFallbacksModule();
    return module.generateFormularioIAAS(patientData, responses, hospital);
  },
};

export const resolveTransferFallbackGenerator = (
  templateId: string
): TransferFallbackGenerator | null => TRANSFER_FALLBACK_REGISTRY[templateId] || null;
