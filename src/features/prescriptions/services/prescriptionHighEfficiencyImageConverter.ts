const HIGH_EFFICIENCY_IMAGE_DECODE_ERROR =
  'La foto está en formato HEIC/HEIF y este navegador no pudo convertirla. En Samsung, cambia "Imágenes de alta eficiencia" a desactivado o comparte la foto como JPEG e intenta nuevamente.';

export const buildHighEfficiencyImageDecodeError = (): Error =>
  new Error(HIGH_EFFICIENCY_IMAGE_DECODE_ERROR);

export const withJpegExtension = (fileName: string): string => {
  const baseName = fileName.includes('.') ? fileName.replace(/\.[^.]+$/, '') : fileName;
  return `${baseName}.jpg`;
};

export const convertHighEfficiencyImageToJpeg = async (file: File): Promise<File> => {
  try {
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.92,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!blob || blob.size === 0) {
      throw new Error('empty HEIC conversion');
    }

    return new File([blob], withJpegExtension(file.name), {
      type: 'image/jpeg',
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    throw buildHighEfficiencyImageDecodeError();
  }
};
