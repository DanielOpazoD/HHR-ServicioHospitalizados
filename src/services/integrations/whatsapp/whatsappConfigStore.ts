import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import type { WhatsAppConfig } from '@/types';

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
    const docRef = doc(db, 'whatsapp', 'config');
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docSnap.data() as WhatsAppConfig;
    }

    return getDefaultWhatsAppConfig();
  } catch (_error) {
    console.error('Error getting WhatsApp config:', _error);
    return null;
  }
}

export async function updateWhatsAppConfig(config: Partial<WhatsAppConfig>): Promise<boolean> {
  try {
    const docRef = doc(db, 'whatsapp', 'config');
    await setDoc(docRef, config, { merge: true });
    return true;
  } catch (_error) {
    console.error('Error updating WhatsApp config:', _error);
    return false;
  }
}
