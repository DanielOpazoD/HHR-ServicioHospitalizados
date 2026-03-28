/**
 * @deprecated Compatibility facade only.
 *
 * New source code must import from the owning domain module:
 * `@/types/domain/clinicalEvents`, `@/types/domain/cudyr`,
 * `@/types/domain/devices`, `@/types/domain/fhir`, or
 * `@/types/domain/patientMaster`.
 */

export type { ClinicalEvent } from './clinicalEvents';
export type { CudyrScore } from './cudyr';
export type { DeviceDetails, DeviceInfo, DeviceInstance, DeviceType } from './devices';
export type { FhirExtension, FhirResource } from './fhir';
export type { HospitalizationEvent, MasterPatient } from './patientMaster';
