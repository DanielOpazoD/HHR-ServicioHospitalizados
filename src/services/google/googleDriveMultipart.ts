export interface DriveUploadResult {
  fileId: string;
  webViewLink: string;
}

const MULTIPART_BOUNDARY = 'foo_bar_boundary';
const MULTIPART_DELIMITER = `\r\n--${MULTIPART_BOUNDARY}\r\n`;
const MULTIPART_CLOSE_DELIMITER = `\r\n--${MULTIPART_BOUNDARY}--`;

const readBlobAsBase64 = async (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result.'));
        return;
      }
      resolve(result.split(',')[1] ?? '');
    };
    reader.readAsDataURL(blob);
  });

export const buildMultipartBody = async (
  blob: Blob,
  metadata: Record<string, unknown>
): Promise<string> => {
  const base64Data = await readBlobAsBase64(blob);

  return (
    MULTIPART_DELIMITER +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    MULTIPART_DELIMITER +
    `Content-Type: ${blob.type}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    base64Data +
    MULTIPART_CLOSE_DELIMITER
  );
};

export const createMultipartHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': `multipart/related; boundary=${MULTIPART_BOUNDARY}`,
});

export const parseDriveUploadResult = async (response: Response): Promise<DriveUploadResult> => {
  const data = await response.json();
  return {
    fileId: data.id,
    webViewLink: data.webViewLink,
  };
};
