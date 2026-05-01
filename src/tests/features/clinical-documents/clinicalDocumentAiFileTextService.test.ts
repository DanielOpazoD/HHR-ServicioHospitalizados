import { describe, expect, it } from 'vitest';
import PizZip from 'pizzip';

import { extractClinicalDocumentAiImportFileText } from '@/features/clinical-documents/services/clinicalDocumentAiFileTextService';

const buildDocxFile = (documentXml: string): File => {
  const zip = new PizZip();
  zip.file(
    '[Content_Types].xml',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'
  );
  zip.file('word/document.xml', documentXml);
  const content = zip.generate({ type: 'uint8array' });
  return new File([content], 'informe-traslado.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
};

describe('clinicalDocumentAiFileTextService', () => {
  it('extracts DOCX text in the browser without relying on mammoth DOMParser behavior', async () => {
    const file = buildDocxFile(`
      <?xml version="1.0" encoding="UTF-8"?>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:body>
          <w:p><w:r><w:t>Informe de traslado por neumonia.</w:t></w:r></w:p>
          <w:p><w:r><w:t>Continuar manejo antibiotico en centro receptor.</w:t></w:r></w:p>
          <w:p><w:r><w:t>Antecedentes: HTA, DM2, EPOC, ERC, FA anticoagulada, alergia a penicilina.</w:t></w:r></w:p>
        </w:body>
      </w:document>
    `);

    const result = await extractClinicalDocumentAiImportFileText(file);

    expect(result.status).toBe('success');
    expect(result.data).toContain('Informe de traslado por neumonia.');
    expect(result.data).toContain('Continuar manejo antibiotico en centro receptor.');
  });
});
