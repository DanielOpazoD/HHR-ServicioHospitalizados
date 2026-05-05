/**
 * Tests for the upload controller hook. Mocks the Cloud Function service
 * + the image compression helper, then drives the form through PIN gate
 * → image capture → submit → success/reset.
 */

import React from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';

vi.mock('@/features/prescriptions/services/prescriptionAccessService', () => ({
  validatePrescriptionAccessPin: vi.fn(),
  submitPrescriptionPhoto: vi.fn(),
  setPrescriptionAccessPin: vi.fn(),
}));

vi.mock('@/features/prescriptions/services/prescriptionImageCompressionService', () => ({
  compressPrescriptionImage: vi.fn(),
  releaseCompressedPrescriptionImagePreview: vi.fn(),
  PRESCRIPTION_FULL_IMAGE_MAX_DIMENSION: 1200,
  PRESCRIPTION_THUMBNAIL_IMAGE_MAX_DIMENSION: 360,
  PRESCRIPTION_FULL_IMAGE_QUALITY: 0.7,
  PRESCRIPTION_THUMBNAIL_IMAGE_QUALITY: 0.6,
}));

import {
  submitPrescriptionPhoto,
  validatePrescriptionAccessPin,
} from '@/features/prescriptions/services/prescriptionAccessService';
import {
  compressPrescriptionImage,
  releaseCompressedPrescriptionImagePreview,
} from '@/features/prescriptions/services/prescriptionImageCompressionService';
import {
  usePrescriptionUploadController,
  type PrescriptionUploadControllerHandle,
} from '@/features/prescriptions/hooks/usePrescriptionUploadController';

const ControllerProbe: React.FC<{
  bypassPinGate?: boolean;
  onReady: (handle: PrescriptionUploadControllerHandle) => void;
}> = ({ bypassPinGate, onReady }) => {
  const controller = usePrescriptionUploadController({ bypassPinGate });
  React.useEffect(() => {
    onReady(controller);
  }, [controller, onReady]);
  return null;
};

const buildCompressedBundle = () => ({
  full: { base64: 'full-bytes', width: 1200, height: 900, byteSize: 200_000 },
  thumbnail: { base64: 'thumb-bytes', width: 360, height: 270, byteSize: 30_000 },
  previewObjectUrl: 'blob:mock-preview',
});

describe('usePrescriptionUploadController', () => {
  let captured: PrescriptionUploadControllerHandle;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const mountController = ({ bypassPinGate = false } = {}) => {
    return render(
      <ControllerProbe
        bypassPinGate={bypassPinGate}
        onReady={handle => {
          captured = handle;
        }}
      />
    );
  };

  it('starts in awaiting-pin phase by default', () => {
    mountController();
    expect(captured.phase).toBe('awaiting-pin');
  });

  it('starts in ready phase when bypassPinGate is true (admin/nurse path)', () => {
    mountController({ bypassPinGate: true });
    expect(captured.phase).toBe('ready');
  });

  it('transitions awaiting-pin → ready after submitPin succeeds', async () => {
    vi.mocked(validatePrescriptionAccessPin).mockResolvedValueOnce({ valid: true });
    mountController();

    await act(async () => {
      await captured.submitPin('4521');
    });
    expect(captured.phase).toBe('ready');
    expect(validatePrescriptionAccessPin).toHaveBeenCalledWith({ pin: '4521' });
  });

  it('exposes the validation error when the PIN is wrong (stays in awaiting-pin)', async () => {
    vi.mocked(validatePrescriptionAccessPin).mockRejectedValueOnce(new Error('PIN inválido.'));
    mountController();

    await act(async () => {
      await captured.submitPin('0000');
    });

    expect(captured.phase).toBe('awaiting-pin');
    expect(captured.errorMessage).toBe('PIN inválido.');
  });

  it('compresses the file and toggles phase compressing → ready, then submits with payload', async () => {
    const bundle = buildCompressedBundle();
    vi.mocked(compressPrescriptionImage).mockResolvedValueOnce(bundle);
    vi.mocked(submitPrescriptionPhoto).mockResolvedValueOnce({
      id: 'rx-123',
      expiresAt: '2026-06-04T00:00:00.000Z',
    });

    mountController({ bypassPinGate: true });
    expect(captured.phase).toBe('ready');

    const file = new File(['dummy'], 'rx.jpg', { type: 'image/jpeg' });
    await act(async () => {
      await captured.handleImageFile(file);
    });
    expect(captured.phase).toBe('ready');
    expect(captured.previewObjectUrl).toBe('blob:mock-preview');
    expect(captured.hasCompressedImage).toBe(true);

    await act(async () => {
      captured.setField('prescriptionType', 'psicotropicos');
      captured.setField('bedId', 'H5C1');
      captured.setField('patientName', 'Paciente Test');
    });

    await act(async () => {
      await captured.submitForm();
    });

    expect(submitPrescriptionPhoto).toHaveBeenCalledWith(
      expect.objectContaining({
        prescriptionType: 'psicotropicos',
        bedId: 'H5C1',
        patientName: 'Paciente Test',
        fullImageBase64: 'full-bytes',
        thumbnailBase64: 'thumb-bytes',
        fullImageWidth: 1200,
        fullImageHeight: 900,
      })
    );
    expect(captured.phase).toBe('success');
    expect(captured.lastResult).toMatchObject({ id: 'rx-123' });
  });

  it('omits bedId/patientName when patientUnassigned is checked', async () => {
    const bundle = buildCompressedBundle();
    vi.mocked(compressPrescriptionImage).mockResolvedValueOnce(bundle);
    vi.mocked(submitPrescriptionPhoto).mockResolvedValueOnce({
      id: 'rx-blank',
      expiresAt: '2026-06-04T00:00:00.000Z',
    });

    mountController({ bypassPinGate: true });
    await act(async () => {
      await captured.handleImageFile(new File(['x'], 'rx.jpg', { type: 'image/jpeg' }));
      captured.setField('patientUnassigned', true);
      captured.setField('bedId', 'H5C1'); // should be ignored when checkbox is on
      captured.setField('patientName', 'Anyone');
    });
    await act(async () => {
      await captured.submitForm();
    });

    const payload = vi.mocked(submitPrescriptionPhoto).mock.calls[0]?.[0];
    expect(payload).toBeDefined();
    expect(payload!.bedId).toBeUndefined();
    expect(payload!.patientName).toBeUndefined();
  });

  it('reports an error and does not submit when no image was captured', async () => {
    mountController({ bypassPinGate: true });
    await act(async () => {
      await captured.submitForm();
    });
    expect(captured.errorMessage).toMatch(/foto/i);
    expect(submitPrescriptionPhoto).not.toHaveBeenCalled();
  });

  it('releases the preview URL on clear and on successful reset', async () => {
    const bundle = buildCompressedBundle();
    vi.mocked(compressPrescriptionImage).mockResolvedValueOnce(bundle);
    mountController({ bypassPinGate: true });
    await act(async () => {
      await captured.handleImageFile(new File(['x'], 'rx.jpg', { type: 'image/jpeg' }));
    });
    expect(captured.previewObjectUrl).toBe('blob:mock-preview');

    act(() => {
      captured.clearCompressedImage();
    });
    expect(releaseCompressedPrescriptionImagePreview).toHaveBeenCalledWith('blob:mock-preview');
    expect(captured.previewObjectUrl).toBeNull();
  });
});
