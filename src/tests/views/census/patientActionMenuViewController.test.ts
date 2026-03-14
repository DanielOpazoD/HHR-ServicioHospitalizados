import { describe, expect, it } from 'vitest';
import {
  resolvePatientActionMenuPanelClassName,
  resolvePatientActionMenuViewState,
} from '@/features/census/controllers/patientActionMenuViewController';

describe('patientActionMenuViewController', () => {
  it('shows all interactive actions for editable, unblocked rows', () => {
    const view = resolvePatientActionMenuViewState({
      isBlocked: false,
      readOnly: false,
      accessProfile: 'default',
      hasHistoryAction: true,
      hasClinicalDocumentsAction: true,
      hasExamRequestAction: true,
      hasImagingRequestAction: true,
    });

    expect(view).toEqual({
      showDemographicsAction: true,
      showMenuTrigger: true,
      showHistoryAction: true,
      showUtilityActions: true,
      showClinicalSection: true,
      showClinicalDocumentsAction: true,
      showExamRequestAction: true,
      showImagingRequestAction: true,
    });
  });

  it('hides clinical exam-request action when bed is blocked', () => {
    const view = resolvePatientActionMenuViewState({
      isBlocked: true,
      readOnly: false,
      accessProfile: 'default',
      hasHistoryAction: true,
      hasClinicalDocumentsAction: true,
      hasExamRequestAction: true,
      hasImagingRequestAction: true,
    });

    expect(view.showDemographicsAction).toBe(false);
    expect(view.showMenuTrigger).toBe(true);
    expect(view.showHistoryAction).toBe(true);
    expect(view.showUtilityActions).toBe(true);
    expect(view.showClinicalSection).toBe(false);
    expect(view.showClinicalDocumentsAction).toBe(false);
    expect(view.showExamRequestAction).toBe(false);
    expect(view.showImagingRequestAction).toBe(false);
  });

  it('hides trigger and demographics in read-only mode', () => {
    const view = resolvePatientActionMenuViewState({
      isBlocked: false,
      readOnly: true,
      accessProfile: 'default',
      hasHistoryAction: false,
      hasClinicalDocumentsAction: true,
      hasExamRequestAction: true,
      hasImagingRequestAction: true,
    });

    expect(view.showDemographicsAction).toBe(false);
    expect(view.showMenuTrigger).toBe(true);
    expect(view.showHistoryAction).toBe(false);
    expect(view.showUtilityActions).toBe(false);
    expect(view.showClinicalSection).toBe(true);
    expect(view.showClinicalDocumentsAction).toBe(true);
    expect(view.showExamRequestAction).toBe(false);
    expect(view.showImagingRequestAction).toBe(false);
  });

  it('keeps only clinical documents, exam and imaging actions for specialist census access', () => {
    const view = resolvePatientActionMenuViewState({
      isBlocked: false,
      readOnly: true,
      accessProfile: 'specialist',
      hasHistoryAction: true,
      hasClinicalDocumentsAction: true,
      hasExamRequestAction: true,
      hasImagingRequestAction: true,
    });

    expect(view).toEqual({
      showDemographicsAction: false,
      showMenuTrigger: true,
      showHistoryAction: false,
      showUtilityActions: false,
      showClinicalSection: true,
      showClinicalDocumentsAction: true,
      showExamRequestAction: true,
      showImagingRequestAction: true,
    });
  });

  it('resolves panel anchor class from row menu alignment', () => {
    expect(resolvePatientActionMenuPanelClassName('top')).toBe('top-0');
    expect(resolvePatientActionMenuPanelClassName('bottom')).toBe('bottom-0');
  });
});
