import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { defaultFirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';
import type { WhatsAppLog } from '@/types/whatsapp';
import { logger } from '@/services/utils/loggerService';

const whatsappLoggingLogger = logger.child('WhatsAppLogging');

export async function logWhatsAppOperation(
  log: Omit<WhatsAppLog, 'id' | 'timestamp'>
): Promise<void> {
  try {
    await addDoc(collection(defaultFirestoreRuntime.db, 'whatsappLogs'), {
      ...log,
      timestamp: Timestamp.now(),
    });
  } catch (_error) {
    whatsappLoggingLogger.error('Error logging WhatsApp operation', _error);
  }
}
