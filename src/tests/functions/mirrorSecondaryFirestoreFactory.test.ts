import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v1', () => ({
  config: () => ({}),
}));

const require = createRequire(import.meta.url);
const {
  createMirrorSecondaryFirestore,
  parseMirrorSecondaryServiceAccount,
} = require('../../../functions/lib/mirror/mirrorSecondaryFirestoreFactory.js');

describe('functions mirrorSecondaryFirestoreFactory', () => {
  beforeEach(() => {
    delete process.env.BETA_SERVICE_ACCOUNT_JSON;
    delete process.env.BETA_SERVICE_ACCOUNT_JSON_B64;
  });

  it('parses mirror secondary credentials from env or runtime config', () => {
    process.env.BETA_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'env-project' });
    expect(parseMirrorSecondaryServiceAccount()).toMatchObject({ project_id: 'env-project' });

    delete process.env.BETA_SERVICE_ACCOUNT_JSON;
    process.env.BETA_SERVICE_ACCOUNT_JSON_B64 = Buffer.from(
      JSON.stringify({ project_id: 'beta-project' })
    ).toString('base64');
    expect(parseMirrorSecondaryServiceAccount()).toMatchObject({ project_id: 'beta-project' });
  });

  it('creates a secondary firestore instance when credentials are available', () => {
    process.env.BETA_SERVICE_ACCOUNT_JSON = JSON.stringify({ project_id: 'env-project' });
    const firestore = {};
    const admin = {
      credential: { cert: vi.fn().mockReturnValue('cert') },
      initializeApp: vi.fn().mockReturnValue({ firestore: () => firestore }),
    };

    expect(createMirrorSecondaryFirestore(admin)).toBe(firestore);
    expect(admin.initializeApp).toHaveBeenCalled();
  });
});
