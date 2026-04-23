import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  InitialLoadingScreen,
  resolveInitialLoadingScreenVariant,
  shouldRenderInitialLoadingScreen,
} from '@/components/ui/InitialLoadingScreen';

describe('InitialLoadingScreen', () => {
  it('resolves the login shell variant for the root route', () => {
    expect(resolveInitialLoadingScreenVariant('/')).toBe('login-shell');
  });

  it('falls back to the default loader on the root route when login shell is not preferred', () => {
    expect(resolveInitialLoadingScreenVariant('/', { preferLoginShell: false })).toBe('default');
  });

  it('does not render the initial loading screen for the census route', () => {
    expect(shouldRenderInitialLoadingScreen('/census')).toBe(false);
  });

  it('does not render the initial loading screen for census routes with trailing slashes', () => {
    expect(shouldRenderInitialLoadingScreen('/census/')).toBe(false);
  });

  it('still renders the initial loading screen for non-census routes', () => {
    expect(shouldRenderInitialLoadingScreen('/whatsapp')).toBe(true);
  });

  it('renders the login shell loading screen for the root route', () => {
    render(<InitialLoadingScreen pathname="/" />);

    expect(screen.getByTestId('login-loading-shell')).toBeInTheDocument();
  });

  it('renders the default loading screen for non-census routes', () => {
    render(<InitialLoadingScreen pathname="/whatsapp" />);

    expect(screen.getByTestId('default-loading-screen')).toBeInTheDocument();
  });

  it('renders the default loading screen on the root route when login shell is suppressed', () => {
    render(<InitialLoadingScreen pathname="/" preferLoginShell={false} />);

    expect(screen.getByTestId('default-loading-screen')).toBeInTheDocument();
    expect(screen.queryByTestId('login-loading-shell')).not.toBeInTheDocument();
  });
});
