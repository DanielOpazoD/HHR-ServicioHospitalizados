import { useEffect } from 'react';
import { saveAppSetting } from '@/services/settingsService';

const ACTIVE_LIST_STORAGE_KEY = 'censusEmailActiveRecipientListId';
const RECIPIENTS_STORAGE_KEY = 'censusEmailRecipients';

interface UseCensusEmailRecipientPersistenceEffectParams {
  activeRecipientListId: string;
  recipientsReady: boolean;
  recipients: string[];
}

export const useCensusEmailRecipientPersistenceEffect = ({
  activeRecipientListId,
  recipientsReady,
  recipients,
}: UseCensusEmailRecipientPersistenceEffectParams): void => {
  useEffect(() => {
    if (!recipientsReady) return;
    void saveAppSetting(RECIPIENTS_STORAGE_KEY, recipients);
    void saveAppSetting(ACTIVE_LIST_STORAGE_KEY, activeRecipientListId);
  }, [activeRecipientListId, recipients, recipientsReady]);
};
