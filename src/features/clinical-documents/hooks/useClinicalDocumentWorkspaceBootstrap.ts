import { useEffect, useMemo, useState } from 'react';
import type { PatientData } from '@/types';
import type {
  ClinicalDocumentRecord,
  ClinicalDocumentTemplate,
} from '@/features/clinical-documents/domain/entities';
import { listActiveClinicalDocumentTemplates } from '@/features/clinical-documents/controllers/clinicalDocumentTemplateController';
import { buildClinicalDocumentEpisodeContext } from '@/features/clinical-documents/controllers/clinicalDocumentEpisodeController';
import { hydrateLegacyClinicalDocument } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import { ClinicalDocumentRepository } from '@/services/repositories/ClinicalDocumentRepository';
import { ClinicalDocumentTemplateRepository } from '@/services/repositories/ClinicalDocumentTemplateRepository';

interface UseClinicalDocumentWorkspaceBootstrapParams {
  patient: PatientData;
  currentDateString: string;
  bedId: string;
  isActive: boolean;
  canRead: boolean;
  hospitalId: string;
  role: string;
}

export interface ClinicalDocumentWorkspaceBootstrapState {
  templates: ClinicalDocumentTemplate[];
  selectedTemplateId: string;
  setSelectedTemplateId: React.Dispatch<React.SetStateAction<string>>;
  documents: ClinicalDocumentRecord[];
  selectedDocumentId: string | null;
  setSelectedDocumentId: React.Dispatch<React.SetStateAction<string | null>>;
  episode: ReturnType<typeof buildClinicalDocumentEpisodeContext>;
}

export const useClinicalDocumentWorkspaceBootstrap = ({
  patient,
  currentDateString,
  bedId,
  isActive,
  canRead,
  hospitalId,
  role,
}: UseClinicalDocumentWorkspaceBootstrapParams): ClinicalDocumentWorkspaceBootstrapState => {
  const [templates, setTemplates] = useState<ClinicalDocumentTemplate[]>(
    listActiveClinicalDocumentTemplates()
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('epicrisis');
  const [documents, setDocuments] = useState<ClinicalDocumentRecord[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const episode = useMemo(
    () => buildClinicalDocumentEpisodeContext(patient, currentDateString, bedId),
    [bedId, currentDateString, patient]
  );

  useEffect(() => {
    if (!templates.some(template => template.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0]?.id || 'epicrisis');
    }
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!isActive || !canRead) {
      return;
    }

    let cancelled = false;

    const loadTemplates = async () => {
      const remoteTemplates = await ClinicalDocumentTemplateRepository.listActive(hospitalId);
      if (!cancelled) {
        setTemplates(remoteTemplates);
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [canRead, hospitalId, isActive]);

  useEffect(() => {
    if (!isActive || role !== 'admin' || templates.length > 0) {
      return;
    }

    void ClinicalDocumentTemplateRepository.seedDefaults(hospitalId)
      .then(() => ClinicalDocumentTemplateRepository.listActive(hospitalId))
      .then(setTemplates)
      .catch(error => {
        console.error('[ClinicalDocumentsWorkspace] Failed to seed templates:', error);
        setTemplates(listActiveClinicalDocumentTemplates());
      });
  }, [hospitalId, isActive, role, templates.length]);

  useEffect(() => {
    if (!isActive || !canRead) {
      return;
    }

    const unsubscribe = ClinicalDocumentRepository.subscribeByEpisode(
      episode.episodeKey,
      docs => {
        const hydrated = docs.map(document => hydrateLegacyClinicalDocument(document));
        setDocuments(hydrated);
        setSelectedDocumentId(prev => prev || hydrated[0]?.id || null);
      },
      hospitalId
    );

    return () => {
      unsubscribe();
    };
  }, [canRead, episode.episodeKey, hospitalId, isActive]);

  return {
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    documents,
    selectedDocumentId,
    setSelectedDocumentId,
    episode,
  };
};
