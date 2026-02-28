import { addDoc, collection, Timestamp } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import type { WhatsAppLog } from '@/types';

export async function logWhatsAppOperation(
  log: Omit<WhatsAppLog, 'id' | 'timestamp'>
): Promise<void> {
  try {
    await addDoc(collection(db, 'whatsappLogs'), {
      ...log,
      timestamp: Timestamp.now(),
    });
  } catch (_error) {
    console.error('Error logging WhatsApp operation:', _error);
  }
}
