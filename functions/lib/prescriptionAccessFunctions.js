/**
 * Prescription Access Cloud Functions
 *
 * Three callable endpoints that mediate the prescription-photo backup
 * module:
 *
 *   - `validatePrescriptionAccessPin({ pin })`
 *       Verifies a candidate PIN against the hashed value stored in
 *       `hospitals/{hospitalId}/config/prescriptionsAccess`. Used by the
 *       QR-flow UI to gate the upload form.
 *
 *   - `submitPrescriptionPhoto({ pin?, ... })`
 *       Single canonical write path. Accepts either an authenticated
 *       caller (admin/nurse_hospital/doctor) or a PIN. Uploads two JPEG
 *       blobs (full + thumbnail) and writes the metadata document. The
 *       document carries a precomputed `expiresAt` based on per-type
 *       retention so the cleanup scheduler stays simple.
 *
 *   - `setPrescriptionAccessPin({ newPin })`
 *       Admin-only PIN rotation. Hashes with SHA-256 + per-record salt.
 */

const crypto = require('crypto');
const functions = require('firebase-functions/v1');
const { HOSPITAL_ID } = require('./runtime/runtimeConfig');

const PRESCRIPTION_TYPES = new Set(['comun', 'psicotropicos', 'benzodiazepinas']);
const RETENTION_DAYS_BY_TYPE = {
  comun: 30,
  psicotropicos: 30,
  benzodiazepinas: 30,
};
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BASE64_BYTES = 4 * 1024 * 1024; // 4 MB per blob (full or thumb)
const MIN_PIN_LENGTH = 4;
const MAX_PIN_LENGTH = 12;
const MIN_DIMENSION = 32;
const MAX_DIMENSION = 4096;

// Brute-force protection. Tracked in the same `prescriptionsAccess` doc.
const MAX_PIN_FAILED_ATTEMPTS = 5;
const PIN_LOCKOUT_MINUTES = 15;
const PIN_LOCKOUT_MS = PIN_LOCKOUT_MINUTES * 60 * 1000;

const ADMIN_ALLOWED_ROLES = new Set(['admin']);
const AUTHENTICATED_UPLOAD_ALLOWED_ROLES = new Set([
  'admin',
  'nurse_hospital',
  'doctor_urgency',
  'doctor_specialist',
]);

const hashPin = (pin, salt) => crypto.createHash('sha256').update(`${pin}:${salt}`).digest('hex');

const generatePinSalt = () => crypto.randomBytes(16).toString('hex');

const generatePrescriptionId = () => `rx_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

const computeExpiresAt = (prescriptionType, createdAtIso) => {
  const days = RETENTION_DAYS_BY_TYPE[prescriptionType] ?? 30;
  return new Date(new Date(createdAtIso).getTime() + days * DAY_MS).toISOString();
};

const getHospitalRef = admin => admin.firestore().collection('hospitals').doc(HOSPITAL_ID);
const getPrescriptionsRef = admin => getHospitalRef(admin).collection('prescriptions');
const getAccessConfigRef = admin =>
  getHospitalRef(admin).collection('config').doc('prescriptionsAccess');

const requireAuthentication = context => {
  if (!context?.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }
};

const resolveCallerRole = async (context, resolveRoleForEmail) => {
  const email = String(context?.auth?.token?.email || '')
    .toLowerCase()
    .trim();
  if (!email) return 'unauthorized';
  return resolveRoleForEmail(email);
};

const optionalString = (value, maxLength = 512) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : undefined;

const positiveInteger = (value, fieldName) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${fieldName} must be a positive integer.`
    );
  }
  if (parsed < MIN_DIMENSION || parsed > MAX_DIMENSION) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${fieldName} must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}.`
    );
  }
  return parsed;
};

const decodeBase64 = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Missing required field: ${fieldName}`
    );
  }
  const buffer = Buffer.from(value, 'base64');
  if (!buffer.length || buffer.length > MAX_BASE64_BYTES) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `${fieldName} size is invalid (must be 1–${MAX_BASE64_BYTES} bytes after decoding).`
    );
  }
  return buffer;
};

const requirePinString = pin => {
  if (typeof pin !== 'string' || !pin.trim()) {
    throw new functions.https.HttpsError('invalid-argument', 'PIN ausente o inválido.');
  }
  const trimmed = pin.trim();
  if (trimmed.length < MIN_PIN_LENGTH || trimmed.length > MAX_PIN_LENGTH) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `PIN debe tener entre ${MIN_PIN_LENGTH} y ${MAX_PIN_LENGTH} caracteres.`
    );
  }
  return trimmed;
};

const validatePinAgainstConfig = async (admin, providedPin) => {
  const trimmed = requirePinString(providedPin);
  const ref = getAccessConfigRef(admin);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Acceso de recetas no configurado. Pide al administrador que defina un PIN.'
    );
  }
  const data = snap.data() || {};
  if (!data.pinHash || !data.pinSalt) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Acceso de recetas no configurado.'
    );
  }

  // Brute-force lockout: if too many recent failures landed us in the
  // cooldown window, refuse the attempt without even checking the hash.
  const now = Date.now();
  if (data.lockedUntil && Date.parse(data.lockedUntil) > now) {
    const minutesLeft = Math.max(1, Math.ceil((Date.parse(data.lockedUntil) - now) / 60_000));
    throw new functions.https.HttpsError(
      'permission-denied',
      `Demasiados intentos fallidos. Reintenta en ${minutesLeft} minuto(s).`
    );
  }

  const candidate = hashPin(trimmed, data.pinSalt);
  if (candidate !== data.pinHash) {
    const failedAttempts = Number(data.failedAttempts || 0) + 1;
    const update = { failedAttempts };
    if (failedAttempts >= MAX_PIN_FAILED_ATTEMPTS) {
      update.lockedUntil = new Date(now + PIN_LOCKOUT_MS).toISOString();
      update.failedAttempts = 0; // Reset counter when entering lockout.
    }
    await ref.set(update, { merge: true });
    if (update.lockedUntil) {
      throw new functions.https.HttpsError(
        'permission-denied',
        `Demasiados intentos fallidos. Acceso bloqueado por ${PIN_LOCKOUT_MINUTES} minutos.`
      );
    }
    throw new functions.https.HttpsError('permission-denied', 'PIN inválido.');
  }

  // Successful PIN: clear any in-flight failure counter / lockout marker.
  if (data.failedAttempts || data.lockedUntil) {
    await ref.set({ failedAttempts: 0, lockedUntil: null }, { merge: true });
  }
};

const saveImageBufferToStorage = async ({ admin, path, buffer, contentType }) => {
  const bucket = admin.storage().bucket();
  const token = crypto.randomUUID();
  const file = bucket.file(path);
  await file.save(buffer, {
    resumable: false,
    metadata: {
      contentType,
      metadata: { firebaseStorageDownloadTokens: token },
    },
  });
  return token;
};

const createValidatePinHandler =
  ({ admin }) =>
  async (data, _context) => {
    await validatePinAgainstConfig(admin, data?.pin);
    return { valid: true };
  };

/**
 * Resolves the uploader identity for a `submitPrescriptionPhoto` call.
 * Authenticated clinicians with an upload-allowed role take precedence;
 * otherwise the call must include a valid PIN (QR flow). Mixed flows
 * (authenticated user without role + PIN) fall back to the PIN path.
 */
const resolveUploaderIdentity = async ({ admin, context, payload, resolveRoleForEmail }) => {
  if (context?.auth) {
    const role = await resolveCallerRole(context, resolveRoleForEmail);
    if (AUTHENTICATED_UPLOAD_ALLOWED_ROLES.has(role)) {
      return {
        source: 'authenticated',
        uid: context.auth.uid,
        email: String(context.auth.token?.email || '') || undefined,
      };
    }
    if (payload.pin) {
      await validatePinAgainstConfig(admin, payload.pin);
      return { source: 'qr_pin' };
    }
    throw new functions.https.HttpsError(
      'permission-denied',
      'No tienes permiso para subir recetas. Usa el QR + PIN.'
    );
  }

  await validatePinAgainstConfig(admin, payload.pin);
  return { source: 'qr_pin' };
};

const decodeAndValidateImagePayload = payload => ({
  fullBuffer: decodeBase64(payload.fullImageBase64, 'fullImageBase64'),
  thumbBuffer: decodeBase64(payload.thumbnailBase64, 'thumbnailBase64'),
  width: positiveInteger(payload.fullImageWidth, 'fullImageWidth'),
  height: positiveInteger(payload.fullImageHeight, 'fullImageHeight'),
});

/** Removes keys whose value is `undefined` (Firestore rejects undefined). */
const omitUndefined = value => {
  if (Array.isArray(value)) return value.map(item => omitUndefined(item));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const result = {};
    for (const [key, nested] of Object.entries(value)) {
      if (nested === undefined) continue;
      result[key] = omitUndefined(nested);
    }
    return result;
  }
  return value;
};

const buildPrescriptionRecord = ({
  prescriptionId,
  payload,
  uploaderIdentity,
  fullPath,
  thumbPath,
  fullByteSize,
  width,
  height,
  createdAt,
}) =>
  omitUndefined({
    id: prescriptionId,
    hospitalId: HOSPITAL_ID,
    prescriptionType: payload.prescriptionType,
    bedId: optionalString(payload.bedId, 32),
    patientName: optionalString(payload.patientName, 256),
    patientRut: optionalString(payload.patientRut, 32),
    notes: optionalString(payload.notes, 1024),
    image: {
      storagePath: fullPath,
      thumbnailStoragePath: thumbPath,
      byteSize: fullByteSize,
      width,
      height,
      contentType: 'image/jpeg',
    },
    uploader: {
      source: uploaderIdentity.source,
      uid: uploaderIdentity.uid,
      email: uploaderIdentity.email,
      displayName: optionalString(payload.uploaderDisplayName, 128),
    },
    createdAt,
    expiresAt: computeExpiresAt(payload.prescriptionType, createdAt),
  });

const createSubmitHandler =
  ({ admin, resolveRoleForEmail }) =>
  async (data, context) => {
    const payload = data || {};
    if (!PRESCRIPTION_TYPES.has(payload.prescriptionType)) {
      throw new functions.https.HttpsError('invalid-argument', 'Tipo de receta inválido.');
    }

    const uploaderIdentity = await resolveUploaderIdentity({
      admin,
      context,
      payload,
      resolveRoleForEmail,
    });
    const { fullBuffer, thumbBuffer, width, height } = decodeAndValidateImagePayload(payload);

    const prescriptionId = generatePrescriptionId();
    const storagePrefix = `prescriptions/${HOSPITAL_ID}/${prescriptionId}`;
    const fullPath = `${storagePrefix}/full.jpg`;
    const thumbPath = `${storagePrefix}/thumb.jpg`;

    await saveImageBufferToStorage({
      admin,
      path: fullPath,
      buffer: fullBuffer,
      contentType: 'image/jpeg',
    });
    await saveImageBufferToStorage({
      admin,
      path: thumbPath,
      buffer: thumbBuffer,
      contentType: 'image/jpeg',
    });

    const record = buildPrescriptionRecord({
      prescriptionId,
      payload,
      uploaderIdentity,
      fullPath,
      thumbPath,
      fullByteSize: fullBuffer.length,
      width,
      height,
      createdAt: new Date().toISOString(),
    });

    await getPrescriptionsRef(admin).doc(prescriptionId).set(record);
    return { id: prescriptionId, expiresAt: record.expiresAt };
  };

const createSetPinHandler =
  ({ admin, resolveRoleForEmail }) =>
  async (data, context) => {
    requireAuthentication(context);
    const role = await resolveCallerRole(context, resolveRoleForEmail);
    if (!ADMIN_ALLOWED_ROLES.has(role)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Solo administradores pueden cambiar el PIN.'
      );
    }
    const newPin = requirePinString(data?.newPin);
    const salt = generatePinSalt();
    const hash = hashPin(newPin, salt);
    await getAccessConfigRef(admin).set(
      {
        pinHash: hash,
        pinSalt: salt,
        pinUpdatedAt: new Date().toISOString(),
        pinUpdatedBy: String(context?.auth?.token?.email || '') || null,
      },
      { merge: true }
    );
    return { ok: true };
  };

const createPrescriptionAccessFunctions = ({ admin, resolveRoleForEmail }) => ({
  validatePrescriptionAccessPin: functions.https.onCall(createValidatePinHandler({ admin })),
  submitPrescriptionPhoto: functions.https.onCall(
    createSubmitHandler({ admin, resolveRoleForEmail })
  ),
  setPrescriptionAccessPin: functions.https.onCall(
    createSetPinHandler({ admin, resolveRoleForEmail })
  ),
});

module.exports = {
  createPrescriptionAccessFunctions,
  // Direct handler factories for tests (avoid functions.https.onCall wrapping).
  createValidatePinHandler,
  createSubmitHandler,
  createSetPinHandler,
  // Pure helpers exposed for unit testing.
  hashPin,
  generatePinSalt,
  computeExpiresAt,
};
