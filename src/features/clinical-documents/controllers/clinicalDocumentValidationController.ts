import type {
  ClinicalDocumentRecord,
  ClinicalDocumentValidationIssue,
} from '@/features/clinical-documents/domain/entities';

export const validateClinicalDocument = (
  record: ClinicalDocumentRecord
): ClinicalDocumentValidationIssue[] => {
  const issues: ClinicalDocumentValidationIssue[] = [];

  const requiredPatientFields = record.patientFields.filter(
    field => field.visible !== false && ['nombre', 'rut', 'fing', 'finf', 'hinf'].includes(field.id)
  );

  requiredPatientFields.forEach(field => {
    if (!field.value.trim()) {
      issues.push({
        path: `patientFields.${field.id}`,
        message: `${field.label} es obligatorio.`,
      });
    }
  });

  record.sections.forEach(section => {
    if (section.visible === false || !section.required) {
      return;
    }
    if (!section.content.trim()) {
      issues.push({
        path: `sections.${section.id}`,
        message: `${section.title} es obligatorio.`,
      });
    }
  });

  if (!record.medico.trim()) {
    issues.push({
      path: 'medico',
      message: 'Médico es obligatorio.',
    });
  }

  if (!record.especialidad.trim()) {
    issues.push({
      path: 'especialidad',
      message: 'Especialidad es obligatoria.',
    });
  }

  return issues;
};
