import { createScopedLogger } from '@/services/utils/loggerScope';

export const firebaseConfigLoaderLogger = createScopedLogger('FirebaseConfigLoader');
export const firebaseEnvironmentPolicyLogger = createScopedLogger('FirebaseEnvironmentPolicy');
export const firebaseLazyServicesLogger = createScopedLogger('FirebaseLazyServices');
export const firebaseBootstrapLogger = createScopedLogger('FirebaseBootstrap');
export const firebaseStartupDiagnosticsLogger = createScopedLogger('FirebaseStartupDiagnostics');
