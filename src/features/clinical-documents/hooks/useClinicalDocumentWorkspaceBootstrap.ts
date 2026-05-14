import { useEffect, useMemo, useState } from 'react';
import type { PatientData } from '@/features/clinical-documents/contracts/clinicalDocumentsPatientContract';
import type {
  ClinicalDocumentRecord,
  ClinicalDocumentTemplate,
} from '@/features/clinical-documents/domain/entities';
import { listActiveClinicalDocumentTemplates } from '@/features/clinical-documents/controllers/clinicalDocumentTemplateController';
import { buildClinicalDocumentEpisodeContext } from '@/features/clinical-documents/controllers/clinicalDocumentEpisodeController';
import { hydrateLegacyClinicalDocument } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import {
  executeListActiveClinicalDocumentTemplates,
  executeSeedClinicalDocumentTemplates,
} from '@/application/clinical-documents/clinicalDocumentTemplateUseCases';
import { subscribeClinicalDocumentsByEpisodeKeys } from '@/application/clinical-documents/clinicalDocumentUseCases';
import { clinicalDocumentObservability } from '@/features/clinical-documents/services/clinicalDocumentOperationalTelemetry';
import {
  resolveNextSelectedClinicalDocumentId,
  resolveSelectedClinicalTemplateId,
  shouldSeedClinicalDocumentTemplates,
} from './clinicalDocumentWorkspaceBootstrapSupport';

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
  const [remoteTemplateCount, setRemoteTemplateCount] = useState<number | null>(null);
  const [hasLoadedRemoteTemplates, setHasLoadedRemoteTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('epicrisis');
  const [documents, setDocuments] = useState<ClinicalDocumentRecord[]>([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);

  const episode = useMemo(
    () => buildClinicalDocumentEpisodeContext(patient, currentDateString, bedId),
    [bedId, currentDateString, patient]
  );
  const episodeKeys = useMemo(
    () => Array.from(new Set([episode.episodeKey, ...(episode.alternateEpisodeKeys || [])])),
    [episode.alternateEpisodeKeys, episode.episodeKey]
  );

  const resolvedSelectedTemplateId = useMemo(() => {
    return resolveSelectedClinicalTemplateId(templates, selectedTemplateId);
  }, [selectedTemplateId, templates]);

  useEffect(() => {
    if (!isActive || !canRead) {
      return;
    }

    let cancelled = false;

    const loadTemplates = async () => {
      const remoteTemplatesOutcome = await executeListActiveClinicalDocumentTemplates(hospitalId);
      clinicalDocumentObservability.recordOutcome(
        'list_clinical_document_templates',
        remoteTemplatesOutcome,
        {
          date: currentDateString,
          context: { hospitalId },
        }
      );
      const remoteTemplates = remoteTemplatesOutcome.data;
      if (!cancelled) {
        setTemplates(remoteTemplates);
        setRemoteTemplateCount(remoteTemplates.length);
        setHasLoadedRemoteTemplates(true);
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, [canRead, currentDateString, hospitalId, isActive]);

  useEffect(() => {
    if (
      !shouldSeedClinicalDocumentTemplates({
        isActive,
        role,
        hasLoadedRemoteTemplates,
        remoteTemplateCount,
      })
    ) {
      return;
    }

    void executeSeedClinicalDocumentTemplates(hospitalId).then(outcome => {
      clinicalDocumentObservability.recordOutcome('seed_clinical_document_templates', outcome, {
        date: currentDateString,
        context: { hospitalId },
        allowSuccess: true,
      });
      if (outcome.status === 'failed') {
        setTemplates(listActiveClinicalDocumentTemplates());
        return;
      }
      setTemplates(outcome.data);
    });
  }, [
    currentDateString,
    hasLoadedRemoteTemplates,
    hospitalId,
    isActive,
    remoteTemplateCount,
    role,
  ]);

  useEffect(() => {
    if (!isActive || !canRead) {
      return;
    }

    const unsubscribe = subscribeClinicalDocumentsByEpisodeKeys(
      episodeKeys,
      docs => {
        const hydrated = docs.map(document => hydrateLegacyClinicalDocument(document));
        setDocuments(hydrated);
        setSelectedDocumentId(prev => resolveNextSelectedClinicalDocumentId(hydrated, prev));
      },
      hospitalId
    );

    return () => {
      unsubscribe();
    };
  }, [canRead, episodeKeys, hospitalId, isActive]);

  return {
    templates,
    selectedTemplateId: resolvedSelectedTemplateId,
    setSelectedTemplateId,
    documents,
    selectedDocumentId,
    setSelectedDocumentId,
    episode,
  };
};
