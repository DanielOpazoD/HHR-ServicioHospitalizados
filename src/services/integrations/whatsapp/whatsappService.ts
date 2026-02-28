/**
 * WhatsApp Service - public facade
 *
 * Keeps a stable API for hooks/components while delegating
 * bot communication, Firestore config, templates and shift persistence
 * to smaller internal modules.
 */

import type { WeeklyShift } from '@/types';
import { fetchBotJson } from '@/services/integrations/whatsapp/whatsappBotRuntime';
import { logWhatsAppOperation } from '@/services/integrations/whatsapp/whatsappLogging';
import {
  getWhatsAppConfig,
  updateWhatsAppConfig,
} from '@/services/integrations/whatsapp/whatsappConfigStore';
import {
  formatHandoffMessage,
  getDefaultTemplates,
  getMessageTemplates,
  saveMessageTemplates,
} from '@/services/integrations/whatsapp/whatsappTemplatesStore';
import type { MessageTemplate } from '@/services/integrations/whatsapp/whatsappTemplatesStore';
import {
  saveManualShift,
  subscribeToCurrentShift,
} from '@/services/integrations/whatsapp/whatsappShiftStore';

export type { MessageTemplate };

export async function checkBotHealth(): Promise<{
  status: 'ok' | 'error';
  whatsapp: 'connected' | 'disconnected';
  uptime?: number;
  error?: string;
}> {
  try {
    const response = await fetchBotJson('/health', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      return { status: 'error', whatsapp: 'disconnected', error: 'Bot server not responding' };
    }

    return await response.json();
  } catch (_error) {
    return {
      status: 'error',
      whatsapp: 'disconnected',
      error: 'Cannot connect to bot server',
    };
  }
}

export async function sendWhatsAppMessage(
  groupId: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetchBotJson('/send-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupId, message }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to send message');
    }

    await logWhatsAppOperation({
      type: 'HANDOFF_SENT',
      method: 'MANUAL',
      success: true,
      metadata: { groupId, messageLength: message.length },
    });

    return { success: true, messageId: result.messageId };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    await logWhatsAppOperation({
      type: 'ERROR',
      success: false,
      error: errorMessage,
    });

    return { success: false, error: errorMessage };
  }
}

export async function getWhatsAppGroups(): Promise<Array<{ id: string; name: string }>> {
  try {
    const response = await fetchBotJson('/groups');
    if (!response.ok) {
      throw new Error('Failed to fetch groups');
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching groups:', error);
    return [];
  }
}

export async function fetchShiftsFromGroup(): Promise<{
  success: boolean;
  message: string;
  error?: string;
}> {
  try {
    const response = await fetchBotJson('/fetch-shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    const result = await response.json();
    if (!response.ok) {
      return {
        success: false,
        message: '',
        error: result.error || 'Error al buscar turnos',
      };
    }

    return {
      success: result.success,
      message: result.message,
    };
  } catch (_error: unknown) {
    return {
      success: false,
      message: '',
      error: 'No se pudo conectar al bot server. Verifica que esté corriendo.',
    };
  }
}

export {
  formatHandoffMessage,
  getDefaultTemplates,
  getMessageTemplates,
  getWhatsAppConfig,
  saveManualShift,
  saveMessageTemplates,
  subscribeToCurrentShift,
  updateWhatsAppConfig,
  logWhatsAppOperation,
};

export type { WeeklyShift };
