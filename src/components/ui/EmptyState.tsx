import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export default function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-gray-200 bg-white/60 px-6 py-10 text-center">
      <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#eef6f6] text-[#2D5F5F]">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </span>
      <p className="text-base font-black text-[#0D2B2B]">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm text-gray-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
