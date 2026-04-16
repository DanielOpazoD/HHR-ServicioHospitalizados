/**
 * Photo Upload Controller
 *
 * Pure logic for photo upload validation and metadata preparation.
 */

import { validatePhotoFile, validateConsentFile } from '../domain/woundCareValidation';
import type { FileValidationResult } from '../domain/woundCareValidation';

export interface UploadProgress {
  stage: 'validating' | 'compressing' | 'uploading' | 'saving' | 'done' | 'error';
  message: string;
}

export const UPLOAD_PROGRESS_MESSAGES: Record<UploadProgress['stage'], string> = {
  validating: 'Validando archivo...',
  compressing: 'Comprimiendo imagen...',
  uploading: 'Subiendo al servidor...',
  saving: 'Guardando registro...',
  done: 'Fotografía guardada correctamente.',
  error: 'Error al subir la fotografía.',
};

/** Validate a photo file against accepted types and size limits before upload. */
export const validatePhotoForUpload = (file: File): FileValidationResult => validatePhotoFile(file);

/** Validate a consent file against accepted types and size limits before upload. */
export const validateConsentForUpload = (file: File): FileValidationResult =>
  validateConsentFile(file);

/** Format a byte count into a human-readable string (B / KB / MB). */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Format the compression ratio as a percentage reduction string (e.g. "72% reduccion"). */
export const formatCompressionRatio = (original: number, compressed: number): string => {
  if (original === 0) return '0%';
  const ratio = ((1 - compressed / original) * 100).toFixed(0);
  return `${ratio}% reducción`;
};
