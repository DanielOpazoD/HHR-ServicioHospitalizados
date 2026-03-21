import { doc, getDoc, setDoc } from 'firebase/firestore';
import { defaultFirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';
import type { WhatsAppConfig } from '@/types/whatsapp';
import { logger } from '@/services/utils/loggerService';

const whatsappConfigLogger = logger.child('WhatsAppConfigStore');

export const getDefaultWhatsAppConfig = (): WhatsAppConfig => ({
  enabled: true,
  status: 'disconnected',
  shiftParser: {
    enabled: true,
    sourceGroupId: '',
  },
  handoffNotifications: {
    enabled: true,
    targetGroupId: '',
    autoSendTime: '17:00',
  },
});

export async function getWhatsAppConfig(): Promise<WhatsAppConfig | null> {
  try {
    const docRef = doc(defaultFirestoreRuntime.db, 'whatsapp', 'config');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as WhatsAppConfig;
    }

    return getDefaultWhatsAppConfig();
  } catch (_error) {
    whatsappConfigLogger.error('Failed to get WhatsApp config', _error);
    return null;
  }
}

export async function updateWhatsAppConfig(config: Partial<WhatsAppConfig>): Promise<boolean> {
  try {
    const docRef = doc(defaultFirestoreRuntime.db, 'whatsapp', 'config');
    await setDoc(docRef, config, { merge: true });
    return true;
  } catch (_error) {
    whatsappConfigLogger.error('Failed to update WhatsApp config', _error);
    return false;
  }
}
