import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Trash2 } from 'lucide-react';

import { PatientActionMenuPanel } from '@/features/census/components/patient-row/PatientActionMenuPanel';

describe('PatientActionMenuPanel', () => {
  it('does not render when closed', () => {
    const { container } = render(
      <PatientActionMenuPanel
        isOpen={false}
        binding={{
          align: 'top',
          isBlocked: false,
          readOnly: false,
          indicators: {
            hasClinicalDocument: false,
            isNewAdmission: false,
          },
          availability: {
            showDemographicsAction: true,
            showMenuTrigger: true,
            showHistoryAction: true,
            showUtilityActions: true,
            showClinicalSection: true,
            showClinicalDocumentsAction: true,
            showExamRequestAction: true,
            showImagingRequestAction: true,
          },
        }}
        utilityActions={[]}
        onClose={vi.fn()}
        onAction={vi.fn()}
        onViewHistory={vi.fn()}
        onViewClinicalDocuments={vi.fn()}
        onViewExamRequest={vi.fn()}
        onViewImagingRequest={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders history/clinical actions and dispatches callbacks', () => {
    const onClose = vi.fn();
    const onAction = vi.fn();
    const onViewHistory = vi.fn();
    const onViewClinicalDocuments = vi.fn();
    const onViewExamRequest = vi.fn();

    render(
      <PatientActionMenuPanel
        isOpen={true}
        binding={{
          align: 'bottom',
          isBlocked: false,
          readOnly: false,
          indicators: {
            hasClinicalDocument: true,
            isNewAdmission: true,
          },
          availability: {
            showDemographicsAction: true,
            showMenuTrigger: true,
            showHistoryAction: true,
            showUtilityActions: true,
            showClinicalSection: true,
            showClinicalDocumentsAction: true,
            showExamRequestAction: true,
            showImagingRequestAction: true,
          },
        }}
        utilityActions={[
          {
            action: 'clear',
            label: 'Limpiar',
            title: 'Borrar datos',
            icon: Trash2,
            iconClassName: 'x',
            visibleWhenBlocked: true,
          },
        ]}
        onClose={onClose}
        onAction={onAction}
        onViewHistory={onViewHistory}
        onViewClinicalDocuments={onViewClinicalDocuments}
        onViewExamRequest={onViewExamRequest}
        onViewImagingRequest={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Ver Historial'));
    expect(onViewHistory).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Limpiar'));
    expect(onAction).toHaveBeenCalledWith('clear');

    fireEvent.click(screen.getByText('Documentos Clínicos'));
    expect(onViewClinicalDocuments).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByText('Solicitud Exámenes'));
    expect(onViewExamRequest).toHaveBeenCalledTimes(1);

    const overlay = document.querySelector('.fixed.inset-0.z-40');
    if (!overlay) {
      throw new Error('Overlay not found');
    }
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
