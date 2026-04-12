import React, { useCallback, useRef, useState } from 'react';
import clsx from 'clsx';

import type { ClinicalDocumentRichTextEditorActivationApi } from '@/features/clinical-documents/hooks/useClinicalDocumentRichTextEditorController';
import { useClinicalDocumentRichTextEditorController } from '@/features/clinical-documents/hooks/useClinicalDocumentRichTextEditorController';
import { normalizeClinicalDocumentContentForStorage } from '@/features/clinical-documents/controllers/clinicalDocumentRichTextController';
import { ClinicalDocumentImageEditor } from '@/features/clinical-documents/components/ClinicalDocumentImageEditor';

interface ClinicalDocumentRichTextEditorProps {
  sectionId: string;
  sectionTitle: string;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onActivate?: (sectionId: string, editor: ClinicalDocumentRichTextEditorActivationApi) => void;
  onDeactivate?: (sectionId: string) => void;
  /** Called when user types `/lab` — should return formatted lab text or null. */
  onSlashLab?: () => Promise<string | null>;
}

export const ClinicalDocumentRichTextEditor: React.FC<ClinicalDocumentRichTextEditorProps> = ({
  sectionId,
  sectionTitle,
  value,
  disabled = false,
  onChange,
  onActivate,
  onDeactivate,
  onSlashLab,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [selectedImage, setSelectedImage] = useState<HTMLImageElement | null>(null);

  const { handleActivateInteraction, handleBlur, handleInput, handleKeyDown, handlePaste } =
    useClinicalDocumentRichTextEditorController({
      sectionId,
      value,
      disabled,
      editorRef,
      onChange,
      onActivate,
      onDeactivate,
      onSlashLab,
    });

  // Detect click on an image inside the editor
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'IMG' && !disabled) {
        setSelectedImage(target as HTMLImageElement);
      } else {
        setSelectedImage(null);
      }
      handleActivateInteraction();
    },
    [disabled, handleActivateInteraction]
  );

  // When image is modified via the editor overlay, sync back to onChange
  const handleImageUpdate = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const html = normalizeClinicalDocumentContentForStorage(editor.innerHTML);
    onChange(html);
  }, [editorRef, onChange]);

  const handleImageEditorClose = useCallback(() => {
    setSelectedImage(null);
  }, []);

  return (
    <div className="clinical-document-rich-text-wrap">
      <div
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        role="textbox"
        aria-label={`Contenido ${sectionTitle}`}
        data-section-editor={sectionId}
        className={clsx(
          'clinical-document-textarea clinical-document-rich-text-editor',
          disabled && 'is-readonly'
        )}
        onInput={handleInput}
        onFocus={handleActivateInteraction}
        onClick={handleClick}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
      />

      {selectedImage && (
        <ClinicalDocumentImageEditor
          imageElement={selectedImage}
          onUpdate={handleImageUpdate}
          onClose={handleImageEditorClose}
        />
      )}
    </div>
  );
};
