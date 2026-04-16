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
    <div className="flex flex-col gap-1.5">
      <div className="flex gap-2">
        {/* Camera button (primary, mobile-first) */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={disabled}
          title={disabled ? disabledReason : 'Tomar foto con cámara'}
          aria-label="Tomar foto con cámara"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors touch-manipulation"
        >
          <Camera className="w-5 h-5" />
          <span>Tomar foto</span>
        </button>

        {/* Gallery button (secondary) */}
        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={disabled}
          title={disabled ? disabledReason : 'Seleccionar de galería'}
          aria-label="Seleccionar foto de galería"
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors touch-manipulation"
        >
          <ImagePlus className="w-5 h-5" />
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
      </div>
      {disabled && disabledReason && <p className="text-[11px] text-slate-400">{disabledReason}</p>}
    </div>
  );
};
