import type {
  ClinicalActionConfig,
  UtilityActionConfig,
} from '@/features/census/components/patient-row/patientActionMenuConfig';
import { CLINICAL_ACTIONS } from '@/features/census/components/patient-row/patientActionMenuConfig';
import type { PatientActionMenuViewState } from '@/features/census/controllers/patientActionMenuViewController';

interface ResolvePatientActionMenuPanelModelParams {
  viewState: PatientActionMenuViewState;
  utilityActions: UtilityActionConfig[];
  showCmaAction?: boolean;
}

export interface PatientActionMenuPanelModel {
  shouldRender: boolean;
  showHistoryAction: boolean;
  showUtilityActions: boolean;
  utilityActions: UtilityActionConfig[];
  clinicalActions: readonly ClinicalActionConfig[];
}

export const resolvePatientActionMenuPanelModel = ({
  viewState,
  utilityActions,
  showCmaAction = true,
}: ResolvePatientActionMenuPanelModelParams): PatientActionMenuPanelModel => {
  const clinicalActions = viewState.showBuiltInClinicalActions
    ? CLINICAL_ACTIONS.filter(action => action.action !== 'cma' || showCmaAction)
    : [];

  return {
    shouldRender:
      viewState.showHistoryAction || viewState.showUtilityActions || clinicalActions.length > 0,
    showHistoryAction: viewState.showHistoryAction,
    showUtilityActions: viewState.showUtilityActions,
    utilityActions,
    clinicalActions,
  };
};
