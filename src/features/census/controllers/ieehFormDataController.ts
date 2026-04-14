import type { PatientData } from '@/features/census/controllers/censusActionPatientContracts';
import type { IeehData } from '@/features/census/contracts/censusMovementContracts';
import type { ClinicalDocumentIeehDraft } from '@/features/clinical-documents/domain/entities';
import type { DischargeFormData } from '@/services/pdf/ieehPdfService';

export interface IeehFormDraftValues {
  diagnosticoPrincipal: string;
  cie10Code: string;
  cie10Display: string;
  condicionEgreso: string;
  tieneIntervencion: boolean;
  intervencionDescrip: string;
  tieneProcedimiento: boolean;
  procedimientoDescrip: string;
  tratanteApellido1: string;
  tratanteApellido2: string;
  tratanteNombre: string;
  tratanteRut: string;
}

/**
 * Builds initial IEEH form values. Priority:
 *  1. Previously saved IEEH data (from the discharge record)
 *  2. IEEH draft from the epicrisis (pre-filled by the doctor)
 *  3. Patient data fallback (CIE-10 from admission, if available)
 */
export const buildIeehInitialDraftValues = (
  patient: PatientData,
  savedIeehData?: IeehData,
  epicrisisDraft?: ClinicalDocumentIeehDraft
): IeehFormDraftValues => {
  // 1. Highest priority: previously saved IEEH data
  if (savedIeehData) {
    return {
      diagnosticoPrincipal: savedIeehData.diagnosticoPrincipal || '',
      cie10Code: savedIeehData.cie10Code || '',
      cie10Display: savedIeehData.diagnosticoPrincipal || '',
      condicionEgreso: savedIeehData.condicionEgreso || '1',
      tieneIntervencion: savedIeehData.intervencionQuirurgica === '1',
      intervencionDescrip: savedIeehData.intervencionQuirurgDescrip || '',
      tieneProcedimiento: savedIeehData.procedimiento === '1',
      procedimientoDescrip: savedIeehData.procedimientoDescrip || '',
      tratanteApellido1: savedIeehData.tratanteApellido1 || '',
      tratanteApellido2: savedIeehData.tratanteApellido2 || '',
      tratanteNombre: savedIeehData.tratanteNombre || '',
      tratanteRut: savedIeehData.tratanteRut || '',
    };
  }

  // 2. Pre-fill from epicrisis IEEH draft (doctor already selected CIE-10)
  if (epicrisisDraft?.cie10Code) {
    return {
      diagnosticoPrincipal: epicrisisDraft.diagnosticoPrincipal || '',
      cie10Code: epicrisisDraft.cie10Code,
      cie10Display: epicrisisDraft.cie10Description || '',
      condicionEgreso: epicrisisDraft.condicionEgreso || '1',
      tieneIntervencion: epicrisisDraft.intervencionQuirurgica === '1',
      intervencionDescrip: epicrisisDraft.intervencionQuirurgDescrip || '',
      tieneProcedimiento: epicrisisDraft.procedimiento === '1',
      procedimientoDescrip: epicrisisDraft.procedimientoDescrip || '',
      tratanteApellido1: '',
      tratanteApellido2: '',
      tratanteNombre: '',
      tratanteRut: '',
    };
  }

  // 3. Fallback: patient admission data
  return {
    diagnosticoPrincipal: patient.cie10Description || patient.pathology || '',
    cie10Code: patient.cie10Code || '',
    cie10Display: patient.cie10Description || '',
    condicionEgreso: '1',
    tieneIntervencion: false,
    intervencionDescrip: '',
    tieneProcedimiento: false,
    procedimientoDescrip: '',
    tratanteApellido1: '',
    tratanteApellido2: '',
    tratanteNombre: '',
    tratanteRut: '',
  };
};

export const buildPersistedIeehData = (draft: IeehFormDraftValues): IeehData => ({
  diagnosticoPrincipal: draft.diagnosticoPrincipal || undefined,
  cie10Code: draft.cie10Code || undefined,
  condicionEgreso: draft.condicionEgreso,
  intervencionQuirurgica: draft.tieneIntervencion ? '1' : '2',
  intervencionQuirurgDescrip: draft.tieneIntervencion
    ? draft.intervencionDescrip || undefined
    : undefined,
  procedimiento: draft.tieneProcedimiento ? '1' : '2',
  procedimientoDescrip: draft.tieneProcedimiento
    ? draft.procedimientoDescrip || undefined
    : undefined,
  tratanteApellido1: draft.tratanteApellido1 || undefined,
  tratanteApellido2: draft.tratanteApellido2 || undefined,
  tratanteNombre: draft.tratanteNombre || undefined,
  tratanteRut: draft.tratanteRut || undefined,
});

export const buildIeehPrintDischargeData = (
  baseDischargeData: DischargeFormData,
  draft: IeehFormDraftValues
): DischargeFormData => ({
  ...baseDischargeData,
  ...buildPersistedIeehData(draft),
});
