import { useEffect } from 'react';
import { saveAppSetting } from '@/services/settingsService';

const RECIPIENTS_STORAGE_KEY = 'censusEmailRecipients';

interface UseCensusEmailRecipientPersistenceEffectParams {
  recipientsReady: boolean;
  recipients: string[];
}

export const useCensusEmailRecipientPersistenceEffect = ({
  recipientsReady,
  recipients,
}: UseCensusEmailRecipientPersistenceEffectParams): void => {
  useEffect(() => {
    if (!recipientsReady) return;
    void saveAppSetting(RECIPIENTS_STORAGE_KEY, recipients);
  }, [recipients, recipientsReady]);
};
