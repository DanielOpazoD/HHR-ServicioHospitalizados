/**
 * Tests for FeatureFlags Service
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('FeatureFlags', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should return default values for flags', async () => {
    const { featureFlags, isFeatureEnabled } = await import('@/services/utils/featureFlags');

    // Check that defaults are respected
    expect(featureFlags.isEnabled('ENABLE_ANALYTICS_VIEW')).toBe(
      isFeatureEnabled('ENABLE_ANALYTICS_VIEW')
    );
    expect(featureFlags.isEnabled('SHOW_DEBUG_PANEL')).toBe(isFeatureEnabled('SHOW_DEBUG_PANEL'));
  });

  it('should enable and disable flags', async () => {
    const { featureFlags } = await import('@/services/utils/featureFlags');

    featureFlags.enable('SHOW_DEBUG_PANEL');
    expect(featureFlags.isEnabled('SHOW_DEBUG_PANEL')).toBe(true);

    featureFlags.disable('SHOW_DEBUG_PANEL');
    expect(featureFlags.isEnabled('SHOW_DEBUG_PANEL')).toBe(false);
  });

  it('should toggle flags', async () => {
    const { featureFlags } = await import('@/services/utils/featureFlags');

    const initial = featureFlags.isEnabled('SHOW_DEBUG_PANEL');
    const toggled = featureFlags.toggle('SHOW_DEBUG_PANEL');

    expect(toggled).toBe(!initial);
    expect(featureFlags.isEnabled('SHOW_DEBUG_PANEL')).toBe(!initial);
  });

  it('should get all flags', async () => {
    const { featureFlags } = await import('@/services/utils/featureFlags');

    const allFlags = featureFlags.getAll();
    expect(allFlags.SHOW_DEBUG_PANEL).toBe(featureFlags.isEnabled('SHOW_DEBUG_PANEL'));
    expect(allFlags.ENABLE_ANALYTICS_VIEW).toBe(featureFlags.isEnabled('ENABLE_ANALYTICS_VIEW'));
  });

  it('should reset flags to defaults', async () => {
    const { featureFlags, FEATURE_FLAGS } = await import('@/services/utils/featureFlags');

    featureFlags.enable('SHOW_DEBUG_PANEL');
    featureFlags.reset('SHOW_DEBUG_PANEL');

    // After reset, should return to default
    expect(featureFlags.isEnabled('SHOW_DEBUG_PANEL')).toBe(FEATURE_FLAGS.SHOW_DEBUG_PANEL);
  });

  it('should notify subscribers when a flag changes', async () => {
    const { featureFlags } = await import('@/services/utils/featureFlags');
    const values: boolean[] = [];
    const unsubscribe = featureFlags.subscribe('SHOW_DEBUG_PANEL', enabled => values.push(enabled));

    featureFlags.enable('SHOW_DEBUG_PANEL');
    featureFlags.disable('SHOW_DEBUG_PANEL');
    unsubscribe();
    featureFlags.enable('SHOW_DEBUG_PANEL');

    expect(values).toEqual([true, false]);
  });

  it('should reset all flags back to defaults', async () => {
    const { featureFlags, FEATURE_FLAGS } = await import('@/services/utils/featureFlags');

    featureFlags.enable('SHOW_DEBUG_PANEL');
    featureFlags.disable('ENABLE_ANALYTICS_VIEW');
    featureFlags.resetAll();

    expect(featureFlags.getAll()).toEqual(FEATURE_FLAGS);
  });
});
