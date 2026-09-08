"use client";

import React, { useRef, useState } from "react";
import { UploadCloud, Camera, X, FileText, CheckCircle2, AlertCircle } from "lucide-react";

interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  error?: string;
}

export function FileUpload({ onFileSelect, selectedFile, error }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const validTypes = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!validTypes.includes(file.type)) {
      alert("Por favor selecciona una imagen válida (JPG, PNG, WebP) o un archivo PDF.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("El archivo excede el tamaño máximo permitido de 5 MB.");
      return;
    }

    onFileSelect(file);

    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setPreviewUrl(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onFileSelect(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="w-full space-y-2">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
        Comprobante de Transferencia / Voucher <span className="text-rose-500">*</span>
      </label>

      {/* Inputs ocultos */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        }}
      />

      {!selectedFile ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border border-dashed rounded-2xl p-6 text-center transition-all duration-200 cursor-pointer ${
            isDragging
              ? "border-slate-500 bg-slate-100/60 dark:bg-slate-800/40"
              : error
              ? "border-rose-400 dark:border-rose-600 bg-rose-50/20 dark:bg-rose-950/20"
              : "border-slate-300 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 hover:border-slate-400 dark:hover:border-slate-600 hover:bg-slate-100/50 dark:hover:bg-slate-800/30"
          }`}
        >
          <div className="flex flex-col items-center justify-center space-y-2.5">
            <div className="w-11 h-11 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center shadow-sm">
              <UploadCloud className="w-5 h-5" strokeWidth={1.75} />
            </div>

            <div>
              <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200">
                Arrastra tu comprobante aquí o pulsa para explorar
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Archivos JPG, PNG, WebP o PDF (Máximo 5 MB)
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm transition-all"
              >
                <UploadCloud className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                Seleccionar archivo
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/70 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200/70 dark:hover:bg-slate-700 transition-all"
              >
                <Camera className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
                Tomar foto
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Tarjeta de vista previa */
        <div className="relative border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 bg-white dark:bg-slate-900 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 overflow-hidden">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Vista previa del comprobante"
                className="w-14 h-14 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shadow-inner flex-shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-700">
                <FileText className="w-6 h-6" strokeWidth={1.75} />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {selectedFile.name}
                </p>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" strokeWidth={1.75} />
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
              </p>
              <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200/60 dark:border-emerald-800">
                Comprobante cargado
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-2 py-1"
            >
              Cambiar
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
              title="Eliminar comprobante"
            >
              <X className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-500 mt-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
