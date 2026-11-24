'use client';

import { useState } from 'react';

export default function DeclarationEmailRetry({ id, he }: { id: string; he: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  async function retry() {
    setState('sending');
    try {
      const response = await fetch('/api/admin/declarations/' + id, { method: 'POST' });
      setState(response.ok ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  }
  if (state === 'sent') return <span role="status" className="text-sm text-emerald-800">{he ? 'הועבר לשירות הדיוור' : 'Accepted by email provider'}</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" onClick={retry} disabled={state === 'sending'} className="min-h-11 rounded-lg border border-teal-700 px-3 text-sm font-bold text-teal-800">
        {state === 'sending' ? (he ? 'שולח…' : 'Sending…') : (he ? 'שליחה למשרד' : 'Send to office')}
      </button>
      {state === 'error' && <span role="alert" className="text-sm text-red-800">{he ? 'השליחה נכשלה. אפשר לנסות שוב.' : 'Email failed. Try again.'}</span>}
    </div>
  );
}
