'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50 animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
            'w-full max-w-lg bg-white rounded-2xl shadow-xl p-6 animate-slide-up',
            className
          )}
        >
          {title && (
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title className="text-lg font-bold text-gray-900">
                {title}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button className="p-1 rounded-lg hover:bg-gray-100 transition-colors" aria-label="סגור">
                  <X className="w-5 h-5 text-gray-500" aria-hidden="true" />
                </button>
              </Dialog.Close>
            </div>
          )}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
