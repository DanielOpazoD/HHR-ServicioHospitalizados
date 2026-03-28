export interface FhirExtension {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueDateTime?: string;
  valueCodeableConcept?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface FhirResource {
  resourceType: string;
  id?: string;
  meta?: {
    profile?: string[];
  };
  extension?: FhirExtension[];
  [key: string]: unknown;
}
