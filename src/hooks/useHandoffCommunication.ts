import { useState, useCallback } from 'react';
import type { DailyRecord } from '@/hooks/contracts/dailyRecordHookContracts';
import {
  getWhatsAppConfig,
  getMessageTemplates,
} from '@/services/integrations/whatsapp/whatsappService';
import {
  defaultBrowserWindowRuntime,
  writeClipboardText,
} from '@/shared/runtime/browserWindowRuntime';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import { createScopedLogger } from '@/services/utils/loggerScope';
import type { ApplicationOutcome } from '@/application/shared/applicationOutcome';
import { resolveApplicationOutcomeMessage } from '@/application/shared/applicationOutcomeMessage';
import { buildManualMedicalHandoffMessageModel } from '@/hooks/controllers/manualMedicalHandoffMessageController';

/**
 * useHandoffCommunication Hook
 *
 * Handles WhatsApp integrations and link sharing for handoffs.
 */
const handoffCommunicationLogger = createScopedLogger('useHandoffCommunication');

export const useHandoffCommunication = (
  record: DailyRecord | null,
  visibleBeds: { id: string }[],
  sendMedicalHandoff: (content: string, groupId: string) => Promise<void>,
  ensureMedicalHandoffSignatureLink: (
    scope?: MedicalHandoffScope
  ) => Promise<ApplicationOutcome<{ handoffUrl: string } | null>>,
  onSuccess: (message: string, description?: string) => void
) => {
  const [whatsappSending, setWhatsappSending] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);

  /**
   * Copies the unique signature link to the system clipboard.
   */
  const handleShareLink = useCallback(
    async (scope: MedicalHandoffScope = 'all') => {
      if (!record) return;
      try {
        const result = await ensureMedicalHandoffSignatureLink(scope);
        if (result.status !== 'success' || !result.data?.handoffUrl) {
          onSuccess(
            resolveApplicationOutcomeMessage(result, 'No se pudo copiar el enlace al portapapeles.')
          );
          return;
        }
        await writeClipboardText(result.data.handoffUrl);
        const scopeLabel =
          scope === 'upc' ? 'UPC' : scope === 'no-upc' ? 'No UPC' : 'todos los pacientes';
        onSuccess(
          'Enlace copiado',
          `El link para firma médica de ${scopeLabel} ha sido copiado al portapapeles.`
        );
      } catch (error: unknown) {
        const err = error as Error;
        onSuccess(err.message || 'No se pudo copiar el enlace al portapapeles.');
      }
    },
    [ensureMedicalHandoffSignatureLink, onSuccess, record]
  );

  /**
   * Sends the medical handoff summary via WhatsApp service.
   */
  const handleSendWhatsApp = useCallback(async () => {
    if (!record) return;
    setWhatsappSending(true);
    try {
      const config = await getWhatsAppConfig();
      const templates = await getMessageTemplates();

      if (!config || !config.handoffNotifications?.targetGroupId) {
        throw new Error('WhatsApp no configurado. Configure el grupo destino en ajustes.');
      }

      const handoffTemplate = templates.find(t => t.type === 'handoff');
      if (!handoffTemplate) {
        throw new Error('No se encontró template de entrega médica');
      }

      await sendMedicalHandoff(handoffTemplate.content, config.handoffNotifications.targetGroupId);
      setWhatsappSent(true);
      onSuccess('Entrega enviada a WhatsApp correctamente');
    } catch (error: unknown) {
      const err = error as Error;
      handoffCommunicationLogger.error('Failed to send WhatsApp handoff', err);
      onSuccess(err.message || 'Error al enviar a WhatsApp');
    } finally {
      setWhatsappSending(false);
    }
  }, [record, sendMedicalHandoff, onSuccess]);

  /**
   * Manual WhatsApp sharing pre-filled for browser opening.
   */
  const handleSendWhatsAppManual = useCallback(async () => {
    if (!record) return;
    try {
      const templates = await getMessageTemplates();
      const handoffTemplate = templates.find(t => t.type === 'handoff');
      if (!handoffTemplate) {
        throw new Error('No se encontró template de entrega médica');
      }

      const handoffModel = buildManualMedicalHandoffMessageModel(record, visibleBeds);
      const handoffLinkResult = await ensureMedicalHandoffSignatureLink('all');
      if (handoffLinkResult.status !== 'success' || !handoffLinkResult.data?.handoffUrl) {
        throw new Error(
          resolveApplicationOutcomeMessage(
            handoffLinkResult,
            'No se pudo preparar el enlace de firma médica.'
          )
        );
      }
      const handoffUrl = handoffLinkResult.data.handoffUrl;

      const message =
        `\uD83C\uDFE5 Hospital Hanga Roa\n` +
        `\uD83D\uDCCB Entrega de Turno M\u00E9dico\n\n` +
        `\uD83D\uDCC5 Fecha: ${handoffModel.formattedDate}\n` +
        `\uD83D\uDC68\u200D\u2695\uFE0F Entregado por: ${handoffModel.doctorName}\n` +
        `\uD83D\uDD51 Firmado: ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}\n\n` +
        `\uD83D\uDCCA Resumen:\n` +
        `\u2022 Hospitalizados: ${handoffModel.hospitalized} pacientes\n` +
        `\u2022 Camas libres: ${handoffModel.freeBeds}\n` +
        `\u2022 Nuevos ingresos: 0\n` +
        `\u2022 Altas: 0\n\n` +
        `\uD83D\uDD17 Ver entrega completa:\n` +
        `${handoffUrl}\n\n` +
        `- Enviado manualmente por Sistema HHR`;

      const encodedMessage = encodeURIComponent(message);
      defaultBrowserWindowRuntime.open(
        `https://api.whatsapp.com/send?text=${encodedMessage}`,
        '_blank'
      );
    } catch (error: unknown) {
      const err = error as Error;
      handoffCommunicationLogger.error('Failed to prepare manual WhatsApp handoff', err);
      onSuccess(err.message || 'Error al preparar WhatsApp');
    }
  }, [ensureMedicalHandoffSignatureLink, record, visibleBeds, onSuccess]);

  return {
    whatsappSending,
    whatsappSent,
    handleShareLink,
    handleSendWhatsApp,
    handleSendWhatsAppManual,
  };
};
