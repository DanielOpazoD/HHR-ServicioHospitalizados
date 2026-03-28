import { doc, getDoc, setDoc } from 'firebase/firestore';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';
import type { WhatsAppConfig } from '@/types/whatsapp';
import { whatsappConfigLogger } from '@/services/integrations/integrationLoggers';

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

export const createWhatsAppConfigStore = (
  runtime: FirestoreServiceRuntimePort = defaultFirestoreServiceRuntime
) => {
  const getConfigDocRef = () => doc(runtime.getDb(), 'whatsapp', 'config');

  const getWhatsAppConfig = async (): Promise<WhatsAppConfig | null> => {
    try {
      const docSnap = await getDoc(getConfigDocRef());

      if (docSnap.exists()) {
        return docSnap.data() as WhatsAppConfig;
      }

      return getDefaultWhatsAppConfig();
    } catch (_error) {
      whatsappConfigLogger.error('Failed to get WhatsApp config', _error);
      return null;
    }
  };

  const updateWhatsAppConfig = async (config: Partial<WhatsAppConfig>): Promise<boolean> => {
    try {
      await setDoc(getConfigDocRef(), config, { merge: true });
      return true;
    } catch (_error) {
      whatsappConfigLogger.error('Failed to update WhatsApp config', _error);
      return false;
    }
  };

  return {
    getWhatsAppConfig,
    updateWhatsAppConfig,
  };
};

const defaultWhatsAppConfigStore = createWhatsAppConfigStore();

export const getWhatsAppConfig = defaultWhatsAppConfigStore.getWhatsAppConfig;
export const updateWhatsAppConfig = defaultWhatsAppConfigStore.updateWhatsAppConfig;
