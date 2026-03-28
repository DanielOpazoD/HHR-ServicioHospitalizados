import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';
import type { WhatsAppLog } from '@/types/whatsapp';
import { createScopedLogger } from '@/services/utils/loggerScope';

const whatsappLoggingLogger = createScopedLogger('WhatsAppLogging');

export const createWhatsAppLoggingStore = (
  runtime: FirestoreServiceRuntimePort = defaultFirestoreServiceRuntime
) => {
  const logWhatsAppOperation = async (
    log: Omit<WhatsAppLog, 'id' | 'timestamp'>
  ): Promise<void> => {
    try {
      await addDoc(collection(runtime.getDb(), 'whatsappLogs'), {
        ...log,
        timestamp: Timestamp.now(),
      });
    } catch (_error) {
      whatsappLoggingLogger.error('Error logging WhatsApp operation', _error);
    }
  };

  return {
    logWhatsAppOperation,
  };
};

const defaultWhatsAppLoggingStore = createWhatsAppLoggingStore();

export const logWhatsAppOperation = defaultWhatsAppLoggingStore.logWhatsAppOperation;
