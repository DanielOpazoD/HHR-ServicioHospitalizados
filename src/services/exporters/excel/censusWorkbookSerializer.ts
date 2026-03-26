import type { Workbook } from 'exceljs';

const WORKBOOK_STRUCTURE_PASSWORD = 'HHR';

const toUint8Array = (buffer: ArrayBuffer | Uint8Array | Buffer): Uint8Array => {
  if (buffer instanceof Uint8Array) {
    return new Uint8Array(buffer);
  }

  return new Uint8Array(buffer);
};

const hashLegacyWorkbookPassword = (password: string): string => {
  let hash = 0;

  for (let index = password.length - 1; index >= 0; index -= 1) {
    const characterCode = password.charCodeAt(index);
    const rotatedBit = (hash >> 14) & 0x0001;
    hash = ((hash << 1) & 0x7fff) | rotatedBit;
    hash ^= characterCode;
  }

  const rotatedBit = (hash >> 14) & 0x0001;
  hash = ((hash << 1) & 0x7fff) | rotatedBit;
  hash ^= password.length;
  hash ^= 0xce4b;

  return hash.toString(16).toUpperCase().padStart(4, '0');
};

const injectWorkbookProtectionXml = (workbookXml: string, workbookPasswordHash: string): string => {
  const workbookProtectionTag = `<workbookProtection lockStructure="1" workbookPassword="${workbookPasswordHash}"/>`;

  if (/<workbookProtection\b[^>]*\/>/.test(workbookXml)) {
    return workbookXml.replace(/<workbookProtection\b[^>]*\/>/, workbookProtectionTag);
  }

  if (/<workbookProtection\b[^>]*>[\s\S]*?<\/workbookProtection>/.test(workbookXml)) {
    return workbookXml.replace(
      /<workbookProtection\b[^>]*>[\s\S]*?<\/workbookProtection>/,
      workbookProtectionTag
    );
  }

  if (/<workbookPr\b[^>]*\/>/.test(workbookXml)) {
    return workbookXml.replace(
      /<workbookPr\b[^>]*\/>/,
      match => `${match}${workbookProtectionTag}`
    );
  }

  if (/<workbookPr\b[^>]*>[\s\S]*?<\/workbookPr>/.test(workbookXml)) {
    return workbookXml.replace(
      /<workbookPr\b[^>]*>[\s\S]*?<\/workbookPr>/,
      match => `${match}${workbookProtectionTag}`
    );
  }

  if (/<bookViews\b/.test(workbookXml)) {
    return workbookXml.replace(/<bookViews\b/, `${workbookProtectionTag}<bookViews`);
  }

  if (/<sheets\b/.test(workbookXml)) {
    return workbookXml.replace(/<sheets\b/, `${workbookProtectionTag}<sheets`);
  }

  return workbookXml.replace(/<workbook\b[^>]*>/, match => `${match}${workbookProtectionTag}`);
};

export const serializeProtectedCensusWorkbook = async (workbook: Workbook): Promise<Uint8Array> => {
  const { default: PizZip } = await import('pizzip');

  const workbookBytes = toUint8Array(await workbook.xlsx.writeBuffer());
  const zip = new PizZip(workbookBytes);
  const workbookXmlFile = zip.file('xl/workbook.xml');

  if (!workbookXmlFile) {
    throw new Error('No se pudo aplicar la protección del libro Excel.');
  }

  const workbookXml = workbookXmlFile.asText();
  const protectedWorkbookXml = injectWorkbookProtectionXml(
    workbookXml,
    hashLegacyWorkbookPassword(WORKBOOK_STRUCTURE_PASSWORD)
  );

  zip.file('xl/workbook.xml', protectedWorkbookXml);

  return zip.generate({
    type: 'uint8array',
    compression: 'DEFLATE',
  }) as Uint8Array;
};

export const __private__ = {
  hashLegacyWorkbookPassword,
  injectWorkbookProtectionXml,
};
