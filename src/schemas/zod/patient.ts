import { z } from 'zod';
import { BedType, PatientStatus, Specialty } from '@/types';
import { nullableOptional, resolveLegacyNameParts } from './helpers';

export const BedTypeSchema = z.nativeEnum(BedType) as z.ZodType<BedType>;
export const PatientStatusSchema = z.nativeEnum(PatientStatus);

const SpecialtyEnumSchema = z.nativeEnum(Specialty);
export const SpecialtySchema = z.preprocess(val => {
  // Migrate legacy values to the new combined specialty
  if (val === 'Ginecología' || val === 'Obstetricia') {
    return Specialty.GINECOBSTETRICIA;
  }
  return val;
}, SpecialtyEnumSchema);

export const CudyrScoreSchema = z.object({
  changeClothes: z.number().min(0).max(4).catch(0),
  mobilization: z.number().min(0).max(4).catch(0),
  feeding: z.number().min(0).max(4).catch(0),
  elimination: z.number().min(0).max(4).catch(0),
  psychosocial: z.number().min(0).max(4).catch(0),
  surveillance: z.number().min(0).max(4).catch(0),
  vitalSigns: z.number().min(0).max(4).catch(0),
  fluidBalance: z.number().min(0).max(4).catch(0),
  oxygenTherapy: z.number().min(0).max(4).catch(0),
  airway: z.number().min(0).max(4).catch(0),
  proInterventions: z.number().min(0).max(4).catch(0),
  skinCare: z.number().min(0).max(4).catch(0),
  pharmacology: z.number().min(0).max(4).catch(0),
  invasiveElements: z.number().min(0).max(4).catch(0),
});

export const DeviceInfoSchema = z.object({
  installationDate: z.string().optional(),
  removalDate: z.string().optional(),
  note: z.string().optional(),
});

export const DeviceDetailsSchema = z
  .object({
    CUP: DeviceInfoSchema.optional(),
    CVC: DeviceInfoSchema.optional(),
    VMI: DeviceInfoSchema.optional(),
    'VVP#1': DeviceInfoSchema.optional(),
    'VVP#2': DeviceInfoSchema.optional(),
    'VVP#3': DeviceInfoSchema.optional(),
  })
  .catchall(DeviceInfoSchema);

export const ClinicalEventSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    date: z.string(),
    note: z.string().optional(),
    createdAt: z.string(),
  })
  .passthrough();

export const FhirResourceSchema = z
  .object({
    resourceType: z.string(),
    id: nullableOptional(z.string()),
    meta: nullableOptional(
      z.object({
        profile: nullableOptional(z.array(z.string())),
      })
    ),
  })
  .passthrough();

import { PatientData } from '@/types';

export const PatientDataSchema: z.ZodType<PatientData, z.ZodTypeDef, unknown> = z.lazy(() =>
  z
    .object({
      bedId: z.string().default(''),
      isBlocked: z.boolean().default(false),
      blockedReason: nullableOptional(z.string()),
      bedMode: z.enum(['Cama', 'Cuna']).default('Cama'),
      hasCompanionCrib: z.boolean().default(false),
      clinicalCrib: z
        .lazy(() => PatientDataSchema)
        .nullable()
        .optional()
        .transform(v => v ?? undefined),
      patientName: z.string().default(''),
      firstName: z.string().default(''),
      lastName: z.string().default(''),
      secondLastName: z.string().default(''),
      identityStatus: nullableOptional(z.enum(['provisional', 'official'])),
      rut: z.string().default(''),
      documentType: nullableOptional(
        z.preprocess(v => (v === '' ? undefined : v), z.enum(['RUT', 'Pasaporte']).optional())
      ),
      age: z.string().default(''),
      birthDate: nullableOptional(z.string()),
      biologicalSex: nullableOptional(
        z.preprocess(
          v => (v === '' ? undefined : v),
          z.enum(['Masculino', 'Femenino', 'Indeterminado']).optional()
        )
      ),
      insurance: nullableOptional(
        z.preprocess(
          v => (v === '' ? undefined : v),
          z.enum(['Fonasa', 'Isapre', 'Particular']).optional()
        )
      ),
      admissionOrigin: nullableOptional(
        z.preprocess(
          v => (v === '' ? undefined : v),
          z.enum(['CAE', 'APS', 'Urgencias', 'Pabellón', 'Otro']).optional()
        )
      ),
      admissionOriginDetails: nullableOptional(z.string()),
      origin: nullableOptional(
        z.preprocess(
          v => (v === '' ? undefined : v),
          z.enum(['Residente', 'Turista Nacional', 'Turista Extranjero']).optional()
        )
      ),
      isRapanui: nullableOptional(z.boolean()),
      pathology: z.string().default(''),
      snomedCode: nullableOptional(z.string()),
      cie10Code: nullableOptional(z.string()),
      cie10Description: nullableOptional(z.string()),
      diagnosisComments: nullableOptional(z.string()),
      specialty: SpecialtySchema.default(Specialty.EMPTY),
      secondarySpecialty: nullableOptional(z.union([z.nativeEnum(Specialty), z.string()])),
      status: z.nativeEnum(PatientStatus).default(PatientStatus.EMPTY),
      admissionDate: z.string().default(''),
      admissionTime: z.string().default(''),
      hasWristband: z.boolean().default(true),
      devices: z.array(z.string()).default([]),
      deviceDetails: nullableOptional(DeviceDetailsSchema),
      surgicalComplication: z.boolean().default(false),
      isUPC: z.boolean().default(false),
      location: nullableOptional(z.string()),
      cudyr: nullableOptional(CudyrScoreSchema),
      handoffNote: nullableOptional(z.string()),
      handoffNoteDayShift: nullableOptional(z.string()),
      handoffNoteNightShift: nullableOptional(z.string()),
      medicalHandoffNote: nullableOptional(z.string()),
      clinicalEvents: z.array(ClinicalEventSchema).default([]),
      fhir_resource: nullableOptional(FhirResourceSchema),
    })
    .passthrough()
    .transform(patient => {
      const inferredIdentityStatus =
        patient.identityStatus ??
        (patient.bedMode === 'Cuna' && !patient.rut?.trim() ? 'provisional' : 'official');

      const hasNameParts = Boolean(
        patient.firstName?.trim() || patient.lastName?.trim() || patient.secondLastName?.trim()
      );

      if (hasNameParts || !patient.patientName?.trim()) {
        return {
          ...patient,
          identityStatus: inferredIdentityStatus,
        };
      }

      return {
        ...patient,
        identityStatus: inferredIdentityStatus,
        ...resolveLegacyNameParts(patient.patientName),
      };
    })
);
