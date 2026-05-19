"use client";

import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, X } from "lucide-react";

interface ScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

export function Scanner({ onScan, onClose }: ScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanning = useRef(false);

  useEffect(() => {
    const startScanner = async () => {
      try {
        const html5QrCode = new Html5Qrcode("qr-reader");
        scannerRef.current = html5QrCode;
        isScanning.current = true;

        await html5QrCode.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (isScanning.current && decodedText) {
              isScanning.current = false;
              html5QrCode.stop();
              onScan(decodedText);
            }
          },
          () => {}
        );
      } catch (err) {
        setError("No se pudo acceder a la cámara. Verifica los permisos.");
        console.error(err);
      }
    };

    startScanner();
    return () => {
      isScanning.current = false;
      scannerRef.current?.stop().catch(() => {});
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
      >
        <X className="w-6 h-6" />
      </button>
      <div className="text-white text-center mb-4">
        <Camera className="w-12 h-12 mx-auto mb-2 opacity-80" />
        <p className="text-lg font-medium">Escanea el código de barras o QR</p>
        <p className="text-sm text-white/70 mt-1">Apunta la cámara al código</p>
      </div>
      {error ? (
        <div className="bg-amber-500/20 text-amber-200 p-4 rounded-lg max-w-sm">
          {error}
        </div>
      ) : (
        <div id="qr-reader" className="rounded-lg overflow-hidden max-w-sm w-full" />
      )}
    </div>
  );
}
