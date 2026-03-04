import { useMemo, useCallback, useRef, useEffect } from 'react';
import { DailyRecord, DailyRecordPatch, MedicalHandoffActor, MedicalSpecialty } from '@/types';
import { BEDS } from '@/constants';
import { useNotification } from '@/context/UIContext';
import { getPreviousDay } from '@/services/repositories/DailyRecordRepository';
import {
  formatHandoffMessage,
  sendWhatsAppMessage,
} from '@/services/integrations/whatsapp/whatsappService';
import { useAuditContext } from '@/context/AuditContext';
import { getAttributedAuthors } from '@/services/admin/attributionService';
import type { MedicalHandoffScope } from '@/features/handoff/controllers';
import {
  buildMedicalHandoffSignatureLink,
  resolveScopedMedicalSignatureToken,
} from '@/features/handoff/controllers';
import {
  buildChecklistUpdateRecord,
  buildMedicalNoChangesRecord,
  buildMedicalSentPatch,
  buildMedicalSignatureRecord,
  buildMedicalSpecialtyNoteRecord,
  buildNovedadesUpdateRecord,
  buildResetMedicalHandoffRecord,
  normalizeMedicalHandoffActor,
} from '@/features/handoff/controllers/handoffManagementController';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';

interface ConfirmMedicalSpecialtyNoChangesInput {
  specialty: MedicalSpecialty;
  actor: Partial<MedicalHandoffActor>;
  comment?: string;
  dateKey?: string;
}

export interface HandoffManagementActions {
  updateHandoffChecklist: (shift: 'day' | 'night', field: string, value: boolean | string) => void;
  updateHandoffNovedades: (shift: 'day' | 'night' | 'medical', value: string) => void;
  updateMedicalSpecialtyNote: (
    specialty: MedicalSpecialty,
    value: string,
    actor: Partial<MedicalHandoffActor>
  ) => Promise<void>;
  confirmMedicalSpecialtyNoChanges: (input: ConfirmMedicalSpecialtyNoChangesInput) => Promise<void>;
  updateHandoffStaff: (
    shift: 'day' | 'night',
    type: 'delivers' | 'receives' | 'tens',
    staffList: string[]
  ) => void;
  updateMedicalSignature: (doctorName: string, scope?: MedicalHandoffScope) => Promise<void>;
  updateMedicalHandoffDoctor: (doctorName: string) => Promise<void>;
  markMedicalHandoffAsSent: (doctorName?: string, scope?: MedicalHandoffScope) => Promise<void>;
  ensureMedicalHandoffSignatureLink: (scope?: MedicalHandoffScope) => Promise<string>;
  resetMedicalHandoffState: () => Promise<void>;
  sendMedicalHandoff: (templateContent: string, targetGroupId: string) => Promise<void>;
}

const generateMedicalSignatureLinkToken = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `sig_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
};

export const useHandoffManagement = (
  record: DailyRecord | null,
  saveAndUpdate: (updatedRecord: DailyRecord) => Promise<void>,
  patchRecord: (partial: DailyRecordPatch) => Promise<void>
): HandoffManagementActions => {
  const { success, error: notifyError } = useNotification();
  const { logEvent, logDebouncedEvent, userId } = useAuditContext();
  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  const updateHandoffChecklist = useCallback(
    (shift: 'day' | 'night', field: string, value: boolean | string) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      saveAndUpdate(buildChecklistUpdateRecord(currentRecord, shift, field, value));
    },
    [saveAndUpdate]
  );

  const updateHandoffNovedades = useCallback(
    (shift: 'day' | 'night' | 'medical', value: string) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      saveAndUpdate(buildNovedadesUpdateRecord(currentRecord, shift, value));

      // Audit Log (Smart/Debounced)
      const authors = getAttributedAuthors(
        userId,
        currentRecord,
        shift === 'medical' ? undefined : (shift as 'day' | 'night')
      );

      const oldContent =
        shift === 'day'
          ? currentRecord.handoffNovedadesDayShift
          : shift === 'night'
            ? currentRecord.handoffNovedadesNightShift
            : currentRecord.medicalHandoffNovedades;

      logDebouncedEvent(
        'HANDOFF_NOVEDADES_MODIFIED',
        'dailyRecord',
        currentRecord.date,
        {
          shift,
          value,
          changes: {
            novedades: { old: oldContent || '', new: value },
          },
        },
        undefined,
        currentRecord.date,
        authors
      );
    },
    [saveAndUpdate, logDebouncedEvent, userId]
  );

  const updateMedicalSpecialtyNote = useCallback(
    async (specialty: MedicalSpecialty, value: string, actor: Partial<MedicalHandoffActor>) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      const currentNote = currentRecord.medicalHandoffBySpecialty?.[specialty];
      const updatedRecord = buildMedicalSpecialtyNoteRecord(currentRecord, specialty, value, actor);
      await saveAndUpdate(updatedRecord);

      logDebouncedEvent(
        'HANDOFF_NOVEDADES_MODIFIED',
        'dailyRecord',
        currentRecord.date,
        {
          shift: 'medical',
          specialty,
          value,
          operation: 'specialty_note_update',
          changes: {
            novedades: { old: currentNote?.note || '', new: value },
          },
        },
        undefined,
        currentRecord.date
      );
    },
    [logDebouncedEvent, saveAndUpdate]
  );

  const confirmMedicalSpecialtyNoChanges = useCallback(
    async ({ specialty, actor, comment, dateKey }: ConfirmMedicalSpecialtyNoChangesInput) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;

      const currentNote = currentRecord.medicalHandoffBySpecialty?.[specialty];
      if (!currentNote?.note?.trim()) {
        notifyError(
          'Sin nota base',
          'Primero debe existir una entrega del especialista para confirmar continuidad.'
        );
        return;
      }

      const effectiveDateKey = dateKey || currentRecord.date;
      if (currentNote.updatedAt?.slice(0, 10) === effectiveDateKey) {
        notifyError(
          'Ya actualizado hoy',
          'Esta especialidad ya fue actualizada hoy por un especialista.'
        );
        return;
      }

      const now = new Date().toISOString();
      const normalizedActor = normalizeMedicalHandoffActor(actor, specialty);
      const updatedRecord = buildMedicalNoChangesRecord(
        currentRecord,
        specialty,
        actor,
        comment,
        effectiveDateKey
      );
      await saveAndUpdate(updatedRecord);

      logEvent(
        'HANDOFF_NOVEDADES_MODIFIED',
        'dailyRecord',
        currentRecord.date,
        {
          shift: 'medical',
          specialty,
          operation: 'confirm_no_changes',
          comment:
            updatedRecord.medicalHandoffBySpecialty?.[specialty]?.dailyContinuity?.[
              effectiveDateKey
            ]?.comment,
          confirmedAt: now,
          confirmedBy: normalizedActor.displayName,
        },
        undefined,
        currentRecord.date
      );
    },
    [logEvent, notifyError, saveAndUpdate]
  );

  const updateHandoffStaff = useCallback(
    (shift: 'day' | 'night', type: 'delivers' | 'receives' | 'tens', staffList: string[]) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;

      const updatedRecord = { ...currentRecord };

      if (shift === 'day') {
        if (type === 'delivers') {
          updatedRecord.nursesDayShift = staffList;
        } else if (type === 'receives') {
          updatedRecord.nursesNightShift = staffList;
        } else if (type === 'tens') {
          updatedRecord.tensDayShift = staffList;
        }
      } else {
        if (type === 'delivers') {
          updatedRecord.nursesNightShift = staffList;
        } else if (type === 'receives') {
          updatedRecord.handoffNightReceives = staffList;
        } else if (type === 'tens') {
          updatedRecord.tensNightShift = staffList;
        }
      }

      updatedRecord.lastUpdated = new Date().toISOString();
      saveAndUpdate(updatedRecord);
    },
    [saveAndUpdate]
  );

  const updateMedicalSignature = useCallback(
    async (doctorName: string, scope: MedicalHandoffScope = 'all') => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;
      const updatedRecord = buildMedicalSignatureRecord(currentRecord, doctorName, scope);
      await saveAndUpdate(updatedRecord);

      // Audit Log
      logEvent(
        'MEDICAL_HANDOFF_SIGNED',
        'dailyRecord',
        currentRecord.date,
        {
          doctorName,
          signedAt: updatedRecord.medicalSignatureByScope?.[scope]?.signedAt,
          scope,
        },
        undefined,
        currentRecord.date
      );
    },
    [saveAndUpdate, logEvent]
  );

  const updateMedicalHandoffDoctor = useCallback(
    async (doctorName: string): Promise<void> => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;

      const updatedRecord = { ...currentRecord };
      updatedRecord.medicalHandoffDoctor = doctorName;
      updatedRecord.lastUpdated = new Date().toISOString();
      await saveAndUpdate(updatedRecord);
    },
    [saveAndUpdate]
  );

  const markMedicalHandoffAsSent = useCallback(
    (doctorName?: string, scope: MedicalHandoffScope = 'all') => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return Promise.resolve();
      return patchRecord(buildMedicalSentPatch(currentRecord, doctorName, scope));
    },
    [patchRecord]
  );

  const ensureMedicalHandoffSignatureLink = useCallback(
    async (scope: MedicalHandoffScope = 'all'): Promise<string> => {
      const currentRecord = recordRef.current;
      if (!currentRecord) {
        throw new Error('No hay entrega médica disponible para compartir.');
      }

      const existingToken = resolveScopedMedicalSignatureToken(currentRecord, scope);
      if (existingToken) {
        return buildMedicalHandoffSignatureLink(
          defaultBrowserWindowRuntime.getLocationOrigin(),
          currentRecord.date,
          scope,
          existingToken
        );
      }

      const nextToken = generateMedicalSignatureLinkToken();
      await patchRecord({
        medicalSignatureLinkTokenByScope: {
          ...(currentRecord.medicalSignatureLinkTokenByScope || {}),
          [scope]: nextToken,
        },
      });

      const refreshedRecord = {
        ...currentRecord,
        medicalSignatureLinkTokenByScope: {
          ...(currentRecord.medicalSignatureLinkTokenByScope || {}),
          [scope]: nextToken,
        },
      };
      recordRef.current = refreshedRecord;

      return buildMedicalHandoffSignatureLink(
        defaultBrowserWindowRuntime.getLocationOrigin(),
        currentRecord.date,
        scope,
        nextToken
      );
    },
    [patchRecord]
  );

  const resetMedicalHandoffState = useCallback(async () => {
    const currentRecord = recordRef.current;
    if (!currentRecord) return;
    const clearedFields: string[] = [];

    if (currentRecord.medicalHandoffSentAt) {
      clearedFields.push('entrega');
    }

    if (currentRecord.medicalSignature) {
      clearedFields.push('firma');
    }
    const updatedRecord = buildResetMedicalHandoffRecord(currentRecord);
    await saveAndUpdate(updatedRecord);

    logEvent(
      'MEDICAL_HANDOFF_RESTORED',
      'dailyRecord',
      currentRecord.date,
      {
        clearedFields,
        hadMedicalHandoffSentAt: Boolean(currentRecord.medicalHandoffSentAt),
        hadMedicalSignature: Boolean(currentRecord.medicalSignature),
        hadScopedMedicalHandoffSentAt: Boolean(
          currentRecord.medicalHandoffSentAtByScope &&
          Object.keys(currentRecord.medicalHandoffSentAtByScope).length > 0
        ),
        hadScopedMedicalSignature: Boolean(
          currentRecord.medicalSignatureByScope &&
          Object.keys(currentRecord.medicalSignatureByScope).length > 0
        ),
        doctorName: currentRecord.medicalHandoffDoctor || '',
      },
      undefined,
      currentRecord.date
    );
  }, [saveAndUpdate, logEvent]);

  const sendMedicalHandoff = useCallback(
    async (templateContent: string, targetGroupId: string) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;

      try {
        // 1. Get Doctor Name (Auto-fill from previous if empty)
        let doctorName = currentRecord.medicalHandoffDoctor;
        if (!doctorName) {
          const previousRecord = await getPreviousDay(currentRecord.date);
          doctorName = previousRecord?.medicalHandoffDoctor || 'Sin especificar';
        }

        // 2. Calculate Stats (Replica of HandoffView logic)
        const activeExtras = currentRecord.activeExtraBeds || [];
        const visibleBeds = BEDS.filter(bed => !bed.isExtra || activeExtras.includes(bed.id));

        const hospitalized = visibleBeds.filter(
          b => currentRecord.beds[b.id].patientName && !currentRecord.beds[b.id].isBlocked
        ).length;
        const blockedBeds = visibleBeds.filter(b => currentRecord.beds[b.id].isBlocked).length;
        const freeBeds = visibleBeds.length - hospitalized - blockedBeds;

        // 3. Format Message
        const [year, month, day] = currentRecord.date.split('-');
        const dateStr = `${day}-${month}-${year}`;
        const handoffUrl = await ensureMedicalHandoffSignatureLink('all');

        const message = formatHandoffMessage(templateContent, {
          date: dateStr,
          signedBy: doctorName,
          signedAt: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
          hospitalized,
          freeBeds,
          newAdmissions: 0,
          discharges: 0,
          handoffUrl,
        });

        // 4. Send WhatsApp
        const result = await sendWhatsAppMessage(targetGroupId, message);
        if (!result.success) {
          throw new Error(result.error);
        }

        success('WhatsApp Enviado', 'Entrega médica enviada correctamente.');

        // 5. Atomic Patch Update
        const sentAt = new Date().toISOString();
        await patchRecord({
          medicalHandoffDoctor: doctorName,
          medicalHandoffSentAt: sentAt,
          medicalHandoffSentAtByScope: {
            ...(currentRecord.medicalHandoffSentAtByScope || {}),
            all: sentAt,
          },
        });
      } catch (err: unknown) {
        console.error('WhatsApp Logic Error:', err);
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        notifyError('Error al enviar', errorMessage);
      }
    },
    [patchRecord, success, notifyError]
  );

  return useMemo(
    () => ({
      updateHandoffChecklist,
      updateHandoffNovedades,
      updateMedicalSpecialtyNote,
      confirmMedicalSpecialtyNoChanges,
      updateHandoffStaff,
      updateMedicalSignature,
      updateMedicalHandoffDoctor,
      markMedicalHandoffAsSent,
      ensureMedicalHandoffSignatureLink,
      resetMedicalHandoffState,
      sendMedicalHandoff,
    }),
    [
      updateHandoffChecklist,
      updateHandoffNovedades,
      updateMedicalSpecialtyNote,
      confirmMedicalSpecialtyNoChanges,
      updateHandoffStaff,
      updateMedicalSignature,
      updateMedicalHandoffDoctor,
      markMedicalHandoffAsSent,
      ensureMedicalHandoffSignatureLink,
      resetMedicalHandoffState,
      sendMedicalHandoff,
    ]
  );
};
