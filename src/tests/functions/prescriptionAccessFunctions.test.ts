/**
 * Tests for the prescription access Cloud Functions. Mirrors the pattern
 * used by `clinicalDocumentExportFunctions.test.ts`: stub
 * `firebase-functions/v1` and `firebase-admin` so the handler factories
 * run as plain async functions in vitest.
 */

import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v1', () => ({
  https: {
    onCall: (handler: (data: unknown, context: unknown) => unknown) => ({ run: handler }),
    HttpsError: class HttpsError extends Error {
      code: string;

      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
  },
}));

const require = createRequire(import.meta.url);
const {
  createValidatePinHandler,
  createSubmitHandler,
  createSetPinHandler,
  hashPin,
  generatePinSalt,
  computeExpiresAt,
} = require('../../../functions/lib/prescriptionAccessFunctions.js');

interface FakeFirestoreDoc {
  data: Record<string, unknown> | null;
}

const buildAdminHarness = () => {
  const accessConfig: FakeFirestoreDoc = { data: null };
  const writtenPrescriptions: Record<string, Record<string, unknown>> = {};
  const storedBlobs: Record<string, Buffer> = {};

  const docHandle = (path: string) => ({
    get: async () =>
      path.endsWith('config/prescriptionsAccess')
        ? { exists: accessConfig.data !== null, data: () => accessConfig.data }
        : { exists: false, data: () => null },
    set: async (data: Record<string, unknown>, options?: { merge?: boolean }) => {
      if (path.endsWith('config/prescriptionsAccess')) {
        accessConfig.data = options?.merge ? { ...(accessConfig.data || {}), ...data } : data;
      } else if (path.startsWith('prescriptions/')) {
        const id = path.replace('prescriptions/', '');
        writtenPrescriptions[id] = data;
      }
    },
  });

  const collection = (collectionName: string) => ({
    doc: (docId: string) => {
      if (collectionName === 'config' && docId === 'prescriptionsAccess') {
        return docHandle('config/prescriptionsAccess');
      }
      if (collectionName === 'prescriptions') {
        return docHandle(`prescriptions/${docId}`);
      }
      return docHandle(`${collectionName}/${docId}`);
    },
  });

  const hospitalDoc = {
    collection,
  };

  const admin = {
    firestore: () => ({
      collection: (name: string) => {
        if (name === 'hospitals') {
          return {
            doc: () => hospitalDoc,
          };
        }
        return collection(name);
      },
    }),
    storage: () => ({
      bucket: () => ({
        file: (path: string) => ({
          save: async (buffer: Buffer) => {
            storedBlobs[path] = buffer;
          },
        }),
      }),
    }),
  };

  return { admin, accessConfig, writtenPrescriptions, storedBlobs };
};

const seedPin = (accessConfig: FakeFirestoreDoc, pin: string) => {
  const salt = generatePinSalt();
  accessConfig.data = {
    pinHash: hashPin(pin, salt),
    pinSalt: salt,
    pinUpdatedAt: '2026-05-01T00:00:00.000Z',
    pinUpdatedBy: 'admin@h.cl',
  };
};

describe('hashPin / computeExpiresAt', () => {
  it('produces stable hashes for the same pin + salt and different ones for different pins', () => {
    const salt = 'abc123';
    expect(hashPin('1234', salt)).toBe(hashPin('1234', salt));
    expect(hashPin('1234', salt)).not.toBe(hashPin('5678', salt));
  });

  it('computes expiresAt 30 days after createdAt for known types', () => {
    const expiry = computeExpiresAt('comun', '2026-05-04T12:00:00.000Z');
    expect(expiry).toBe('2026-06-03T12:00:00.000Z');
  });
});

describe('validatePrescriptionAccessPin', () => {
  it('returns valid:true when the candidate PIN matches the configured hash', async () => {
    const { admin, accessConfig } = buildAdminHarness();
    seedPin(accessConfig, '7351');

    const handler = createValidatePinHandler({ admin });
    const result = await handler({ pin: '7351' }, undefined);

    expect(result).toEqual({ valid: true });
  });

  it('rejects when the PIN is wrong', async () => {
    const { admin, accessConfig } = buildAdminHarness();
    seedPin(accessConfig, '7351');

    const handler = createValidatePinHandler({ admin });
    await expect(handler({ pin: '0000' }, undefined)).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('rejects when no PIN is configured yet', async () => {
    const { admin } = buildAdminHarness();
    const handler = createValidatePinHandler({ admin });
    await expect(handler({ pin: '7351' }, undefined)).rejects.toMatchObject({
      code: 'failed-precondition',
    });
  });

  it('rejects malformed PIN input (empty, too short, too long)', async () => {
    const { admin, accessConfig } = buildAdminHarness();
    seedPin(accessConfig, '7351');
    const handler = createValidatePinHandler({ admin });

    await expect(handler({ pin: '' }, undefined)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(handler({ pin: '12' }, undefined)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
    await expect(handler({ pin: '1'.repeat(20) }, undefined)).rejects.toMatchObject({
      code: 'invalid-argument',
    });
  });

  it('locks the PIN endpoint for 15 min after 5 consecutive wrong attempts', async () => {
    const { admin, accessConfig } = buildAdminHarness();
    seedPin(accessConfig, '7351');
    const handler = createValidatePinHandler({ admin });

    // 5 wrong attempts → triggers lockout
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(handler({ pin: '0000' }, undefined)).rejects.toMatchObject({
        code: 'permission-denied',
      });
    }

    // Even the correct PIN is rejected during lockout window
    await expect(handler({ pin: '7351' }, undefined)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(accessConfig.data?.lockedUntil).toBeTruthy();
  });

  it('clears the failure counter when the PIN finally matches', async () => {
    const { admin, accessConfig } = buildAdminHarness();
    seedPin(accessConfig, '7351');
    const handler = createValidatePinHandler({ admin });

    // 2 fails (under threshold) — counter at 2
    await expect(handler({ pin: '0000' }, undefined)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    await expect(handler({ pin: '0001' }, undefined)).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(accessConfig.data?.failedAttempts).toBe(2);

    // Correct PIN → counter resets, no lockout marker
    await handler({ pin: '7351' }, undefined);
    expect(accessConfig.data?.failedAttempts).toBe(0);
    expect(accessConfig.data?.lockedUntil).toBeNull();
  });

  it('allows retries again once the lockout window has elapsed', async () => {
    const { admin, accessConfig } = buildAdminHarness();
    seedPin(accessConfig, '7351');
    // Simulate a stale lockout that has already passed.
    accessConfig.data = {
      ...accessConfig.data,
      failedAttempts: 0,
      lockedUntil: new Date(Date.now() - 60_000).toISOString(),
    };

    const handler = createValidatePinHandler({ admin });
    await expect(handler({ pin: '7351' }, undefined)).resolves.toEqual({ valid: true });
  });
});

describe('submitPrescriptionPhoto', () => {
  const validPayload = (overrides: Record<string, unknown> = {}) => ({
    pin: '7351',
    prescriptionType: 'comun',
    bedId: 'H5C1',
    patientName: 'Paciente Test',
    patientRut: '11.111.111-1',
    fullImageBase64: Buffer.from('full-image-bytes').toString('base64'),
    thumbnailBase64: Buffer.from('thumb-image-bytes').toString('base64'),
    fullImageWidth: 1200,
    fullImageHeight: 900,
    uploaderDisplayName: 'Estación QR sala',
    ...overrides,
  });

  it('writes Storage blobs + Firestore record on the QR-PIN path', async () => {
    const { admin, accessConfig, writtenPrescriptions, storedBlobs } = buildAdminHarness();
    seedPin(accessConfig, '7351');

    const handler = createSubmitHandler({
      admin,
      resolveRoleForEmail: vi.fn(),
    });

    const result = await handler(validPayload(), undefined);

    expect(result).toMatchObject({ id: expect.stringMatching(/^rx_/) });
    const id = (result as { id: string }).id;

    // Storage blobs landed
    const storageEntries = Object.keys(storedBlobs);
    expect(storageEntries).toHaveLength(2);
    expect(storageEntries.some(key => key.endsWith('/full.jpg'))).toBe(true);
    expect(storageEntries.some(key => key.endsWith('/thumb.jpg'))).toBe(true);

    // Firestore doc carries the right shape
    const persisted = writtenPrescriptions[id];
    expect(persisted).toMatchObject({
      id,
      prescriptionType: 'comun',
      bedId: 'H5C1',
      patientName: 'Paciente Test',
      uploader: { source: 'qr_pin', displayName: 'Estación QR sala' },
    });
    expect(persisted.image).toMatchObject({
      contentType: 'image/jpeg',
      width: 1200,
      height: 900,
    });
    expect(persisted.expiresAt).toBeTruthy();
  });

  it('accepts an authenticated nurse_hospital caller without PIN', async () => {
    const { admin, writtenPrescriptions } = buildAdminHarness();
    const resolveRoleForEmail = vi.fn().mockResolvedValue('nurse_hospital');

    const handler = createSubmitHandler({ admin, resolveRoleForEmail });
    const payload = validPayload();
    delete (payload as Record<string, unknown>).pin;

    const result = await handler(payload, {
      auth: { uid: 'nurse-1', token: { email: 'enf@h.cl' } },
    });

    const id = (result as { id: string }).id;
    expect(writtenPrescriptions[id].uploader).toMatchObject({
      source: 'authenticated',
      uid: 'nurse-1',
      email: 'enf@h.cl',
    });
  });

  it('rejects an authenticated caller without an allowed role and no PIN', async () => {
    const { admin } = buildAdminHarness();
    const resolveRoleForEmail = vi.fn().mockResolvedValue('viewer');

    const handler = createSubmitHandler({ admin, resolveRoleForEmail });
    const payload = validPayload();
    delete (payload as Record<string, unknown>).pin;

    await expect(
      handler(payload, { auth: { uid: 'visit-1', token: { email: 'visit@h.cl' } } })
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects an unsupported prescription type', async () => {
    const { admin, accessConfig } = buildAdminHarness();
    seedPin(accessConfig, '7351');
    const handler = createSubmitHandler({ admin, resolveRoleForEmail: vi.fn() });

    await expect(
      handler(validPayload({ prescriptionType: 'antibioticos' }), undefined)
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });

  it('rejects oversized image payloads', async () => {
    const { admin, accessConfig } = buildAdminHarness();
    seedPin(accessConfig, '7351');
    const handler = createSubmitHandler({ admin, resolveRoleForEmail: vi.fn() });

    const tooBig = Buffer.alloc(5 * 1024 * 1024).toString('base64');
    await expect(
      handler(validPayload({ fullImageBase64: tooBig }), undefined)
    ).rejects.toMatchObject({ code: 'invalid-argument' });
  });
});

describe('setPrescriptionAccessPin', () => {
  it('hashes and persists the new PIN for admin callers', async () => {
    const { admin, accessConfig } = buildAdminHarness();
    const resolveRoleForEmail = vi.fn().mockResolvedValue('admin');

    const handler = createSetPinHandler({ admin, resolveRoleForEmail });
    await handler(
      { newPin: '835412' },
      {
        auth: { uid: 'a-1', token: { email: 'admin@h.cl' } },
      }
    );

    expect(accessConfig.data).toMatchObject({
      pinUpdatedBy: 'admin@h.cl',
      pinHash: expect.any(String),
      pinSalt: expect.any(String),
    });
  });

  it('rejects non-admin callers', async () => {
    const { admin } = buildAdminHarness();
    const resolveRoleForEmail = vi.fn().mockResolvedValue('nurse_hospital');

    const handler = createSetPinHandler({ admin, resolveRoleForEmail });
    await expect(
      handler(
        { newPin: '835412' },
        {
          auth: { uid: 'n-1', token: { email: 'enf@h.cl' } },
        }
      )
    ).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('rejects unauthenticated callers', async () => {
    const { admin } = buildAdminHarness();
    const handler = createSetPinHandler({ admin, resolveRoleForEmail: vi.fn() });
    await expect(handler({ newPin: '835412' }, undefined)).rejects.toMatchObject({
      code: 'unauthenticated',
    });
  });
});
