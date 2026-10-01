import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export default function EmptyState({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef6f6] text-[#2D5F5F]">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <p className="text-base font-extrabold text-[#0D2B2B]">{title}</p>
      {text && <p className="mt-1 max-w-xs text-sm leading-6 text-slate-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
