import { useEffect, useState } from 'react';

import type { ClinicalDocumentIndicationSpecialtyId } from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';
import {
  addClinicalDocumentIndicationCatalogItem,
  deleteClinicalDocumentIndicationCatalogItem,
  ensureClinicalDocumentIndicationsCatalog,
  getDefaultClinicalDocumentIndicationsCatalog,
  replaceClinicalDocumentIndicationsCatalog,
  subscribeToClinicalDocumentIndicationsCatalog,
  type ClinicalDocumentIndicationsCatalog,
  updateClinicalDocumentIndicationCatalogItem,
} from '@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { createScopedLogger } from '@/services/utils/loggerScope';

interface UseClinicalDocumentIndicationsCatalogParams {
  hospitalId: string;
  isActive: boolean;
  canEdit: boolean;
}

interface UseClinicalDocumentIndicationsCatalogState {
  indicationsCatalog: ClinicalDocumentIndicationsCatalog;
  isSavingCustomIndication: boolean;
  customIndicationError: string | null;
  addCustomIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    text: string
  ) => Promise<boolean>;
  updateIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    itemId: string,
    text: string
  ) => Promise<boolean>;
  deleteIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    itemId: string
  ) => Promise<boolean>;
  importCatalog: (catalog: unknown) => Promise<boolean>;
}

const clinicalDocumentIndicationsCatalogLogger = createScopedLogger(
  'ClinicalDocumentIndicationsCatalogHook'
);

export const useClinicalDocumentIndicationsCatalog = ({
  hospitalId,
  isActive,
  canEdit,
}: UseClinicalDocumentIndicationsCatalogParams): UseClinicalDocumentIndicationsCatalogState => {
  const [indicationsCatalog, setIndicationsCatalog] = useState<ClinicalDocumentIndicationsCatalog>(
    () => getDefaultClinicalDocumentIndicationsCatalog()
  );
  const [isSavingCustomIndication, setIsSavingCustomIndication] = useState(false);
  const [customIndicationError, setCustomIndicationError] = useState<string | null>(null);

  const runCatalogMutation = async (
    action: () => Promise<ClinicalDocumentIndicationsCatalog>,
    errorMessage: string
  ): Promise<boolean> => {
    try {
      setIsSavingCustomIndication(true);
      setCustomIndicationError(null);
      const nextCatalog = await action();
      setIndicationsCatalog(nextCatalog);
      return true;
    } catch (error) {
      clinicalDocumentIndicationsCatalogLogger.error(errorMessage, error);
      setCustomIndicationError('No se pudo guardar la indicación en Firebase.');
      return false;
    } finally {
      setIsSavingCustomIndication(false);
    }
  };

  useEffect(() => {
    if (!isActive) {
      return;
    }

    if (!isFirestoreEnabled()) {
      setIndicationsCatalog(getDefaultClinicalDocumentIndicationsCatalog());
      return;
    }

    const unsubscribe = subscribeToClinicalDocumentIndicationsCatalog(
      setIndicationsCatalog,
      hospitalId
    );

    if (canEdit) {
      void ensureClinicalDocumentIndicationsCatalog(hospitalId).catch(error => {
        clinicalDocumentIndicationsCatalogLogger.error(
          'Error seeding clinical document indications catalog',
          error
        );
      });
    }

    return () => {
      unsubscribe();
    };
  }, [canEdit, hospitalId, isActive]);

  const addCustomIndication = async (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    text: string
  ): Promise<boolean> =>
    runCatalogMutation(
      () =>
        addClinicalDocumentIndicationCatalogItem({
          hospitalId,
          specialtyId,
          text,
        }),
      'Error saving custom clinical indication:'
    );

  const updateIndication = async (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    itemId: string,
    text: string
  ): Promise<boolean> =>
    runCatalogMutation(
      () =>
        updateClinicalDocumentIndicationCatalogItem({
          hospitalId,
          specialtyId,
          itemId,
          text,
        }),
      'Error updating clinical indication:'
    );

  const deleteIndication = async (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    itemId: string
  ): Promise<boolean> =>
    runCatalogMutation(
      () =>
        deleteClinicalDocumentIndicationCatalogItem({
          hospitalId,
          specialtyId,
          itemId,
        }),
      'Error deleting clinical indication:'
    );

  const importCatalog = async (catalog: unknown): Promise<boolean> =>
    runCatalogMutation(
      () =>
        replaceClinicalDocumentIndicationsCatalog({
          hospitalId,
          catalog: catalog as Parameters<
            typeof replaceClinicalDocumentIndicationsCatalog
          >[0]['catalog'],
        }),
      'Error importing clinical indications catalog:'
    );

  return {
    indicationsCatalog,
    isSavingCustomIndication,
    customIndicationError,
    addCustomIndication,
    updateIndication,
    deleteIndication,
    importCatalog,
  };
};
