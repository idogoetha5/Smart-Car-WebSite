'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw } from 'lucide-react';

interface SignaturePadFieldProps {
  isHe: boolean;
  onChange: (dataUrl: string | null) => void;
}

/**
 * Canvas-based signature capture, no external network calls — signature_pad
 * (https://github.com/szimek/signature_pad) is a small, dependency-free
 * canvas wrapper, which fits the same private-by-default posture as the
 * rest of this feature.
 */
export default function SignaturePadField({ isHe, onChange }: SignaturePadFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<import('signature_pad').default | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const { default: SignaturePad } = await import('signature_pad');
      const canvas = canvasRef.current;
      if (!canvas || disposed) return;

      const resize = () => {
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * ratio;
        canvas.height = rect.height * ratio;
        canvas.getContext('2d')?.scale(ratio, ratio);
        padRef.current?.clear();
      };

      const pad = new SignaturePad(canvas, { penColor: '#0D2B2B', backgroundColor: '#ffffff' });
      padRef.current = pad;
      pad.addEventListener('endStroke', () => {
        setHasSignature(!pad.isEmpty());
        onChange(pad.isEmpty() ? null : pad.toDataURL('image/png'));
      });

      resize();
      window.addEventListener('resize', resize);
    })();
    return () => {
      disposed = true;
      padRef.current?.off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => {
    padRef.current?.clear();
    setHasSignature(false);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        className="w-full h-40 rounded-xl border-2 border-dashed border-gray-300 bg-white touch-none"
        aria-label={isHe ? 'אזור חתימה' : 'Signature area'}
      />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {isHe ? 'חתמו באצבע במסך' : 'Sign with your finger on the screen'}
        </p>
        {hasSignature && (
          <button
            type="button"
            onClick={clear}
            className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-red-600"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            {isHe ? 'נקה' : 'Clear'}
          </button>
        )}
      </div>
    </div>
  );
}
