import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { PrintTemplateConfig } from '@/types/printTemplates';
import { COLLECTIONS, HOSPITAL_COLLECTIONS, getActiveHospitalId } from '@/constants/firestorePaths';
import { defaultRepositoryFirestoreRuntime } from '@/services/repositories/repositoryFirestoreRuntime';
import type { RepositoryFirestoreRuntimePort } from '@/services/repositories/ports/repositoryFirestoreRuntimePort';
import { createScopedLogger } from '@/services/utils/loggerScope';

const printTemplateRepositoryLogger = createScopedLogger('PrintTemplateRepository');

export const createPrintTemplateRepository = (
  runtime: RepositoryFirestoreRuntimePort = defaultRepositoryFirestoreRuntime
) => {
  const getTemplateRef = (templateId: string) =>
    doc(
      runtime.getDb(),
      COLLECTIONS.HOSPITALS,
      getActiveHospitalId(),
      HOSPITAL_COLLECTIONS.PRINT_TEMPLATES,
      templateId
    );

  return {
    async getTemplate(templateId: string): Promise<PrintTemplateConfig | null> {
      try {
        const docRef = getTemplateRef(templateId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          return docSnap.data() as PrintTemplateConfig;
        }
        return null;
      } catch (error) {
        printTemplateRepositoryLogger.error(`Error fetching template ${templateId}`, error);
        return null;
      }
    },

    async saveTemplate(config: PrintTemplateConfig): Promise<void> {
      try {
        const docRef = getTemplateRef(config.id);
        await setDoc(docRef, {
          ...config,
          lastUpdated: new Date().toISOString(),
        });
      } catch (error) {
        printTemplateRepositoryLogger.error(`Error saving template ${config.id}`, error);
        throw error;
      }
    },

    subscribe(
      templateId: string,
      callback: (config: PrintTemplateConfig | null) => void
    ): () => void {
      const docRef = getTemplateRef(templateId);

      return onSnapshot(
        docRef,
        docSnap => {
          if (docSnap.exists()) {
            callback(docSnap.data() as PrintTemplateConfig);
          } else {
            callback(null);
          }
        },
        error => {
          printTemplateRepositoryLogger.error(`Error subscribing to template ${templateId}`, error);
          callback(null);
        }
      );
    },
  };
};

export const PrintTemplateRepository = createPrintTemplateRepository();
