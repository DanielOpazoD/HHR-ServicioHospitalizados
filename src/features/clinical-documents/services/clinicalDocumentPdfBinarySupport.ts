export const decodeBase64PdfBlob = (contentBase64: string, mimeType: string): Blob => {
  const clean = contentBase64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new Blob([bytes], { type: mimeType || 'application/pdf' });
};

export const blobToBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  const runtimeBuffer = (
    globalThis as unknown as {
      Buffer?: { from: (data: ArrayBuffer) => { toString: (encoding: string) => string } };
    }
  ).Buffer;

  if (runtimeBuffer) {
    return runtimeBuffer.from(arrayBuffer).toString('base64');
  }

  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};
