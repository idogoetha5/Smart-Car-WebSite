'use client';

import { CheckCircle, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastProps {
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type = 'success', onClose }: ToastProps) {
  const isSuccess = type === 'success';
  return (
    <div
      className={cn(
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3',
        'px-5 py-3 rounded-xl shadow-lg border text-sm font-medium animate-slide-up',
        isSuccess
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
      )}
    >
      {isSuccess ? (
        <CheckCircle className="w-5 h-5 text-green-500" />
      ) : (
        <XCircle className="w-5 h-5 text-red-500" />
      )}
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ms-2 p-0.5 rounded hover:bg-black/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
