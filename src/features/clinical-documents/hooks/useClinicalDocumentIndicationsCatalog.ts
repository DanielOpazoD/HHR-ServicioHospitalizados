import { useEffect, useState } from 'react';

import type { ClinicalDocumentIndicationSpecialtyId } from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';
import {
  addClinicalDocumentIndicationCatalogItem,
  deleteClinicalDocumentIndicationCatalogItem,
  ensureClinicalDocumentIndicationsCatalog,
  getDefaultClinicalDocumentIndicationsCatalog,
  subscribeToClinicalDocumentIndicationsCatalog,
  type ClinicalDocumentIndicationsCatalog,
  updateClinicalDocumentIndicationCatalogItem,
} from '@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService';

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
}

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
      console.error(errorMessage, error);
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

    const unsubscribe = subscribeToClinicalDocumentIndicationsCatalog(
      setIndicationsCatalog,
      hospitalId
    );

    if (canEdit) {
      void ensureClinicalDocumentIndicationsCatalog(hospitalId).catch(error => {
        console.error('Error seeding clinical document indications catalog:', error);
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

  return {
    indicationsCatalog,
    isSavingCustomIndication,
    customIndicationError,
    addCustomIndication,
    updateIndication,
    deleteIndication,
  };
};
