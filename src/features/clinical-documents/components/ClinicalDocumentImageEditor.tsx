/**
 * ClinicalDocumentImageEditor
 *
 * Inline overlay for image editing inside the contentEditable editor.
 * Shows a resize handle at the bottom-right corner and an alignment
 * toolbar above the image. Portal-rendered to avoid contentEditable
 * interference.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlignLeft, AlignCenter, AlignRight, Maximize2, Trash2 } from 'lucide-react';
import {
  resolveImageAlignmentStyles,
  resolveImageToolbarPosition,
  calculateResizedWidth,
  type ImageAlignment,
} from '@/features/clinical-documents/controllers/clinicalDocumentImageEditorController';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClinicalDocumentImageEditorProps {
  /** The DOM image element to edit (must be inside a contentEditable). */
  imageElement: HTMLImageElement;
  /** Called after any style modification so the parent can sync innerHTML. */
  onUpdate: () => void;
  /** Called to dismiss the editor overlay. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HANDLE_SIZE = 10;

const TOOLBAR_ACTIONS: Array<{
  id: ImageAlignment | 'delete';
  icon: React.FC<{ size: number }>;
  label: string;
}> = [
  { id: 'left', icon: AlignLeft, label: 'Alinear izquierda' },
  { id: 'center', icon: AlignCenter, label: 'Centrar' },
  { id: 'right', icon: AlignRight, label: 'Alinear derecha' },
  { id: 'full', icon: Maximize2, label: 'Ancho completo' },
  { id: 'delete', icon: Trash2, label: 'Eliminar imagen' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Applies alignment styles from the controller to a DOM element. */
const applyAlignmentToElement = (img: HTMLImageElement, alignment: ImageAlignment): void => {
  const styles = resolveImageAlignmentStyles(alignment);
  img.style.display = styles.display;
  img.style.marginLeft = styles.marginLeft;
  img.style.marginRight = styles.marginRight;
  img.style.float = styles.float;
  if (styles.width) img.style.width = styles.width;
  if (styles.height) img.style.height = styles.height;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Portal-rendered overlay for inline image editing (resize + alignment).
 * Toolbar position adapts: above the image when space allows, below otherwise.
 */
export const ClinicalDocumentImageEditor: React.FC<ClinicalDocumentImageEditorProps> = ({
  imageElement,
  onUpdate,
  onClose,
}) => {
  const imgRef = useRef(imageElement);
  const [rect, setRect] = useState(() => imageElement.getBoundingClientRect());
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  useEffect(() => {
    imgRef.current = imageElement;
  }, [imageElement]);

  useEffect(() => {
    const refresh = () => setRect(imgRef.current.getBoundingClientRect());
    window.addEventListener('scroll', refresh, true);
    window.addEventListener('resize', refresh);
    return () => {
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDraggingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = imgRef.current.offsetWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const deltaX = ev.clientX - startXRef.current;
        const newWidth = calculateResizedWidth(startWidthRef.current, deltaX);
        imgRef.current.style.width = `${newWidth}px`;
        imgRef.current.style.height = 'auto';
        setRect(imgRef.current.getBoundingClientRect());
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        onUpdate();
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [onUpdate]
  );

  const handleAction = useCallback(
    (actionId: ImageAlignment | 'delete') => {
      if (actionId === 'delete') {
        imgRef.current.remove();
        onClose();
        onUpdate();
        return;
      }
      applyAlignmentToElement(imgRef.current, actionId);
      setRect(imgRef.current.getBoundingClientRect());
      onUpdate();
    },
    [onClose, onUpdate]
  );

  const toolbarPos = resolveImageToolbarPosition(rect);

  return createPortal(
    <>
      <div
        className="fixed z-[10001] flex items-center gap-0.5 rounded-lg bg-white border border-slate-200 shadow-lg px-1 py-0.5"
        style={{
          left: `${toolbarPos.left}px`,
          top: `${toolbarPos.top}px`,
          transform: 'translateX(-50%)',
        }}
      >
        {TOOLBAR_ACTIONS.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => handleAction(action.id)}
              className={`p-1.5 rounded transition-colors ${
                action.id === 'delete'
                  ? 'text-slate-400 hover:text-red-500 hover:bg-red-50'
                  : 'text-slate-500 hover:text-medical-600 hover:bg-medical-50'
              }`}
              title={action.label}
            >
              <Icon size={14} />
            </button>
          );
        })}
      </div>

      <div
        className="fixed z-[10000] pointer-events-none border-2 border-medical-400 rounded"
        style={{
          left: `${rect.left - 2}px`,
          top: `${rect.top - 2}px`,
          width: `${rect.width + 4}px`,
          height: `${rect.height + 4}px`,
        }}
      />

      <div
        className="fixed z-[10001] cursor-se-resize bg-white border-2 border-medical-500 rounded-sm hover:bg-medical-100"
        style={{
          left: `${rect.right - HANDLE_SIZE / 2}px`,
          top: `${rect.bottom - HANDLE_SIZE / 2}px`,
          width: `${HANDLE_SIZE}px`,
          height: `${HANDLE_SIZE}px`,
        }}
        onMouseDown={handleMouseDown}
      />
    </>,
    document.body
  );
};
