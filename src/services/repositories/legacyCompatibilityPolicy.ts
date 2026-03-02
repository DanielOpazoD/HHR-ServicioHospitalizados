export type LegacyCompatibilityMode = 'explicit_bridge' | 'disabled';

const normalizeLegacyMode = (value: string | undefined): LegacyCompatibilityMode => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();

  if (normalized === 'disabled') {
    return 'disabled';
  }

  return 'explicit_bridge';
};

export const getLegacyCompatibilityMode = (): LegacyCompatibilityMode =>
  normalizeLegacyMode(import.meta.env.VITE_LEGACY_COMPATIBILITY_MODE);

export const isLegacyBridgeEnabled = (): boolean =>
  getLegacyCompatibilityMode() === 'explicit_bridge';

export const shouldUseLegacyCompatibilityInHotPath = (): boolean => false;
