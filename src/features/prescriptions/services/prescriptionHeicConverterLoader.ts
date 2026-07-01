export type HeicConverter = (options: {
  blob: Blob;
  toType: string;
  quality?: number;
}) => Promise<Blob | Blob[]>;

export class HeicConverterLoadFailure extends Error {
  constructor(cause: unknown) {
    super('HEIC/HEIF converter runtime could not be loaded.', { cause });
    this.name = 'HeicConverterLoadFailure';
  }
}

let heicConverterPromise: Promise<HeicConverter> | null = null;

const resolveHeicConverter = async (): Promise<HeicConverter> => {
  const { default: heic2any } = await import('heic2any');
  return heic2any as HeicConverter;
};

export const loadHeicConverter = async (): Promise<HeicConverter> => {
  try {
    heicConverterPromise ??= resolveHeicConverter();
    return await heicConverterPromise;
  } catch (error) {
    heicConverterPromise = null;
    throw new HeicConverterLoadFailure(error);
  }
};
