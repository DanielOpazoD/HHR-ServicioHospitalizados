import { vi } from 'vitest';

type LoggerMethod = 'debug' | 'error' | 'info' | 'warn';

type LoggerMock = Record<LoggerMethod, ReturnType<typeof vi.fn>>;

const createTestLogger = (overrides: Partial<LoggerMock> = {}): LoggerMock => ({
  debug: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  ...overrides,
});

export const createLoggerScopeMock = (overrides: Partial<LoggerMock> = {}) => ({
  createScopedLogger: () => createTestLogger(overrides),
  createScopedLoggerMap: (scopes: Record<string, string>) =>
    Object.fromEntries(
      Object.keys(scopes).map(key => [key, createTestLogger(overrides)])
    ) as Record<string, LoggerMock>,
});
