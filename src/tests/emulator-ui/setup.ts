import 'fake-indexeddb/auto';
import { wrapConsoleForOperationalNoise } from '@/tests/utils/operationalConsoleNoiseFilter';

wrapConsoleForOperationalNoise(['warn', 'error']);

if (typeof globalThis.crypto === 'undefined') {
  Object.defineProperty(globalThis, 'crypto', {
    value: {
      randomUUID: () => '00000000-0000-0000-0000-000000000000',
    },
    configurable: true,
  });
} else if (typeof globalThis.crypto.randomUUID !== 'function') {
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    value: () => '00000000-0000-0000-0000-000000000000',
    configurable: true,
  });
}
