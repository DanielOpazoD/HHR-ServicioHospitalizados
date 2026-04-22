export interface ClinicalDocumentValidationIssue {
  path: string;
  message: string;
}

export interface ClinicalDocumentEpisodeContext {
  patientRut: string;
  patientName: string;
  episodeKey: string;
  admissionDate?: string;
  sourceDailyRecordDate?: string;
  sourceBedId?: string;
  specialty?: string;
}
