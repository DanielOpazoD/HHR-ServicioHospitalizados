import { useMemo } from 'react';

import { useNotification } from '@/context/UIContext';
import { buildClinicalDocumentWorkspaceNotifyPort } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';

export const useClinicalDocumentsWorkspaceNotifyPort = () => {
  const { success, warning, error: notifyError, info, confirm } = useNotification();

  const notifyPort = useMemo(
    () => buildClinicalDocumentWorkspaceNotifyPort(success, warning, notifyError, info, confirm),
    [confirm, info, notifyError, success, warning]
  );

  return {
    notifyPort,
    info,
    confirm,
  };
};
