import type { ClinicalDocumentType } from '@/features/clinical-documents/domain/entities';
import { EPICRISIS_CLINICAL_DOCUMENT_DEFINITION } from '@/features/clinical-documents/domain/definitions/epicrisis';
import { EVOLUCION_CLINICAL_DOCUMENT_DEFINITION } from '@/features/clinical-documents/domain/definitions/evolucion';
import { INFORME_MEDICO_CLINICAL_DOCUMENT_DEFINITION } from '@/features/clinical-documents/domain/definitions/informeMedico';
import { EPICRISIS_TRASLADO_CLINICAL_DOCUMENT_DEFINITION } from '@/features/clinical-documents/domain/definitions/epicrisisTraslado';
import { OTRO_CLINICAL_DOCUMENT_DEFINITION } from '@/features/clinical-documents/domain/definitions/otro';
import type { ClinicalDocumentDefinition } from '@/features/clinical-documents/domain/definitions/base';

export type {
  ClinicalDocumentDefinition,
  ClinicalDocumentPrintOptions,
  ClinicalDocumentSectionRendererId,
} from '@/features/clinical-documents/domain/definitions/base';

export const CLINICAL_DOCUMENT_DEFINITION_REGISTRY: Record<
  ClinicalDocumentType,
  ClinicalDocumentDefinition
> = {
  epicrisis: EPICRISIS_CLINICAL_DOCUMENT_DEFINITION,
  evolucion: EVOLUCION_CLINICAL_DOCUMENT_DEFINITION,
  informe_medico: INFORME_MEDICO_CLINICAL_DOCUMENT_DEFINITION,
  epicrisis_traslado: EPICRISIS_TRASLADO_CLINICAL_DOCUMENT_DEFINITION,
  otro: OTRO_CLINICAL_DOCUMENT_DEFINITION,
};

export const getClinicalDocumentDefinition = (
  documentType: ClinicalDocumentType
): ClinicalDocumentDefinition =>
  CLINICAL_DOCUMENT_DEFINITION_REGISTRY[documentType] || CLINICAL_DOCUMENT_DEFINITION_REGISTRY.otro;

export const getClinicalDocumentDefinitionRegistryIntegrity = (): {
  ok: boolean;
  missingTypes: ClinicalDocumentType[];
  invalidSchemaVersionTypes: ClinicalDocumentType[];
  invalidPrintTypes: ClinicalDocumentType[];
} => {
  const expectedTypes: ClinicalDocumentType[] = [
    'epicrisis',
    'evolucion',
    'informe_medico',
    'epicrisis_traslado',
    'otro',
  ];
  const missingTypes = expectedTypes.filter(type => !CLINICAL_DOCUMENT_DEFINITION_REGISTRY[type]);
  const invalidSchemaVersionTypes = expectedTypes.filter(type => {
    const definition = CLINICAL_DOCUMENT_DEFINITION_REGISTRY[type];
    return !definition || !Number.isFinite(definition.schemaVersion);
  });
  const invalidPrintTypes = expectedTypes.filter(type => {
    const definition = CLINICAL_DOCUMENT_DEFINITION_REGISTRY[type];
    return (
      !definition ||
      definition.printOptions.pageSize !== 'letter' ||
      definition.printOptions.mode !== 'inline_browser_print'
    );
  });

  return {
    ok:
      missingTypes.length === 0 &&
      invalidSchemaVersionTypes.length === 0 &&
      invalidPrintTypes.length === 0,
    missingTypes,
    invalidSchemaVersionTypes,
    invalidPrintTypes,
  };
};

export const assertClinicalDocumentDefinitionRegistryIntegrity = (): void => {
  const integrity = getClinicalDocumentDefinitionRegistryIntegrity();
  if (integrity.ok) {
    return;
  }

  throw new Error(
    `[ClinicalDocumentDefinitionRegistry] Invalid registry. Missing=[${integrity.missingTypes.join(
      ', '
    )}] invalidSchema=[${integrity.invalidSchemaVersionTypes.join(
      ', '
    )}] invalidPrint=[${integrity.invalidPrintTypes.join(', ')}]`
  );
};
