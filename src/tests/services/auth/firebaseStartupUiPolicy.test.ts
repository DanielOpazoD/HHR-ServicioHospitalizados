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
    expect(copy.footnote).toContain('podrían no estar disponibles');
  });

  it('returns a single startup failure message for fatal boot errors', () => {
    expect(getFirebaseStartupFailureMessage()).toContain('No se pudo iniciar');
  });

  it('adapts startup warning copy when diagnostics are provided', () => {
    const copy = getFirebaseStartupWarningCopy({
      issues: [
        {
          field: 'apiKey',
          severity: 'blocking',
          summary: 'Falta la clave principal de Firebase.',
          action: 'Configura VITE_FIREBASE_API_KEY.',
        },
      ],
      hasBlockingIssue: true,
      summary: 'La app no puede iniciar por configuración incompleta.',
      nextStep: 'Completa las variables faltantes.',
    });

    expect(copy.summary).toContain('no puede iniciar');
    expect(copy.steps[0]).toContain('VITE_FIREBASE_API_KEY');
  });
});
