export type FirestoreRulesEmulatorConfig = {
  host: string;
  port: number;
};

const DEFAULT_FIRESTORE_RULES_EMULATOR_CONFIG: FirestoreRulesEmulatorConfig = {
  host: '127.0.0.1',
  port: 8080,
};

export const resolveFirestoreRulesEmulatorConfig = (
  hostAndPort: string | undefined
): FirestoreRulesEmulatorConfig => {
  if (!hostAndPort) {
    return DEFAULT_FIRESTORE_RULES_EMULATOR_CONFIG;
  }

  const [host, portText, extra] = hostAndPort.split(':');
  const port = Number(portText);

  if (!host || extra !== undefined || !Number.isInteger(port) || port < 1 || port > 65535) {
    return DEFAULT_FIRESTORE_RULES_EMULATOR_CONFIG;
  }

  return { host, port };
};
