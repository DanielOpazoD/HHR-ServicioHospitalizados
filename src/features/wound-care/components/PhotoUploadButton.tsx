import React, { useRef } from 'react';
import { Camera, ImagePlus } from 'lucide-react';

interface PhotoUploadButtonProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
  disabledReason?: string;
}

export const PhotoUploadButton: React.FC<PhotoUploadButtonProps> = ({
  onFileSelected,
  disabled = false,
  disabledReason,
}) => {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelected(file);
      e.target.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => cameraInputRef.current?.click()}
        disabled={disabled}
        title={disabled ? disabledReason : 'Tomar foto con cámara'}
        aria-label="Tomar foto con cámara"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md transition-colors touch-manipulation"
      >
        <Camera className="w-3.5 h-3.5" />
        <span>Foto</span>
      </button>

      <button
        type="button"
        onClick={() => galleryInputRef.current?.click()}
        disabled={disabled}
        title={disabled ? disabledReason : 'Seleccionar de galería'}
        aria-label="Seleccionar foto de galería"
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed rounded-md transition-colors touch-manipulation"
      >
        <ImagePlus className="w-3.5 h-3.5" />
        <span>Galería</span>
      </button>

      {/* Hidden camera input (opens camera on mobile) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />

      {/* Hidden gallery input (opens file picker) */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />

      {disabled && disabledReason && (
        <span className="text-[10px] text-slate-400">{disabledReason}</span>
      )}
    </>
  );
};
