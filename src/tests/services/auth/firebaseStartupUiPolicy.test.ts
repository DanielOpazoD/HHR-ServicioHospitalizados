import { describe, expect, it } from 'vitest';

import {
  getFirebaseStartupFailureMessage,
  getFirebaseStartupWarningCopy,
} from '@/services/auth/firebaseStartupUiPolicy';

describe('firebaseStartupUiPolicy', () => {
  it('returns user-facing startup warning copy', () => {
    const copy = getFirebaseStartupWarningCopy();

    expect(copy.title).toContain('Configuración');
    expect(copy.summary).toContain('Firebase');
    expect(copy.steps.length).toBeGreaterThanOrEqual(2);
    expect(copy.footnote).toContain('cargando indefinidamente');
  });

  it('returns a single startup failure message for fatal boot errors', () => {
    expect(getFirebaseStartupFailureMessage()).toContain('No se pudo iniciar');
  });
});
