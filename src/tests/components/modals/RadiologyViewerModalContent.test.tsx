import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { RadiologyViewerResults } from '@/components/modals/RadiologyViewerModalContent';
import type { MMRADSearchResult } from '@/services/radiology/mmradService';

const buildResult = (): MMRADSearchResult => ({
  rut: '11111111-1',
  examenes: [
    {
      nombre_examen: 'TC TORAX',
      fecha_examen: '12/04/2026 11:47',
      fecha_asignacion: '12/04/2026 12:00',
      mod: 'CT',
      estado: 'Validado',
      pdf_url: 'https://example.com/report.pdf',
      dicom_url: null,
      informe_html_url: 'https://example.com/report.html',
      portal_web_receipt_url: 'https://example.com/portal-receipt.html',
      report: {
        title: 'TOMOGRAFÍA SIMPLE DE TÓRAX',
        technique: null,
        antecedentesClinicos: null,
        findings: 'Hallazgo de prueba.',
        impression: 'Impresión de prueba.',
      },
    },
  ],
});

describe('RadiologyViewerModalContent', () => {
  it('shows copied state for the matching CT exam action', () => {
    const result = buildResult();

    render(
      <RadiologyViewerResults
        result={result}
        isLoading={false}
        modalities={['CT']}
        activeModTab="CT"
        filteredExams={result.examenes}
        onTabChange={vi.fn()}
        onOpenPdf={vi.fn()}
        onOpenPortalReceipt={vi.fn()}
        onCopyReport={vi.fn()}
        copiedReportExamKey="https://example.com/report.html"
      />
    );

    expect(screen.getByRole('button', { name: /copiado/i })).toBeInTheDocument();
  });

  it('delegates PDF open and copy actions for CT exams with structured reports', () => {
    const result = buildResult();
    const onOpenPdf = vi.fn();
    const onOpenPortalReceipt = vi.fn();
    const onCopyReport = vi.fn();

    render(
      <RadiologyViewerResults
        result={result}
        isLoading={false}
        modalities={['CT']}
        activeModTab="CT"
        filteredExams={result.examenes}
        onTabChange={vi.fn()}
        onOpenPdf={onOpenPdf}
        onOpenPortalReceipt={onOpenPortalReceipt}
        onCopyReport={onCopyReport}
        copiedReportExamKey={null}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /ver pdf/i }));
    fireEvent.click(screen.getByRole('button', { name: /comprobante portal/i }));
    fireEvent.click(screen.getByRole('button', { name: /copiar informe/i }));

    expect(onOpenPdf).toHaveBeenCalledWith(result.examenes[0]);
    expect(onOpenPortalReceipt).toHaveBeenCalledWith(result.examenes[0]);
    expect(onCopyReport).toHaveBeenCalledWith(result.examenes[0]);
  });
});
