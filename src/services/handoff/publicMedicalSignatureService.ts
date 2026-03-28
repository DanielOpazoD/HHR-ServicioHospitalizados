import { httpsCallable } from 'firebase/functions';
import type { DailyRecord } from '@/domain/handoff/recordContracts';
import type { MedicalHandoffScope } from '@/types/medicalHandoff';
import { defaultFunctionsRuntime } from '@/services/firebase-runtime/functionsRuntime';

interface PublicMedicalHandoffPayload {
  record: DailyRecord;
  scope: MedicalHandoffScope;
  alreadySigned: boolean;
}

interface SubmitMedicalHandoffSignaturePayload {
  scope: MedicalHandoffScope;
  signature: {
    doctorName: string;
    signedAt: string;
    userAgent?: string;
  };
  alreadySigned: boolean;
}

export const fetchPublicMedicalHandoffRecord = async (
  date: string,
  scope: MedicalHandoffScope,
  token: string
): Promise<PublicMedicalHandoffPayload> => {
  const functions = await defaultFunctionsRuntime.getFunctions();
  const callable = httpsCallable<
    { date: string; scope: MedicalHandoffScope; token: string },
    PublicMedicalHandoffPayload
  >(functions, 'getMedicalHandoffSignaturePayload');

  const response = await callable({ date, scope, token });
  return response.data;
};

export const submitPublicMedicalHandoffSignature = async ({
  date,
  scope,
  token,
  doctorName,
}: {
  date: string;
  scope: MedicalHandoffScope;
  token: string;
  doctorName: string;
}): Promise<SubmitMedicalHandoffSignaturePayload> => {
  const functions = await defaultFunctionsRuntime.getFunctions();
  const callable = httpsCallable<
    {
      date: string;
      scope: MedicalHandoffScope;
      token: string;
      doctorName: string;
      userAgent?: string;
    },
    SubmitMedicalHandoffSignaturePayload
  >(functions, 'submitMedicalHandoffSignature');

  const response = await callable({
    date,
    scope,
    token,
    doctorName,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  });
  return response.data;
};
