'use client';

import { useEffect, useState } from 'react';

export default function DeclarationCard({ id, he }: { id: string; he: boolean }) {
  const [card, setCard] = useState<{ number: string; expiry: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!card) return;
    const timeout = window.setTimeout(() => setCard(null), 30_000);
    const hide = () => { if (document.hidden) setCard(null); };
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [card]);

  async function toggle() {
    if (card) { setCard(null); return; }
    setError(false);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/declarations/' + id + '/card', { method: 'POST', cache: 'no-store' });
      if (!res.ok) throw new Error('Card unavailable');
      setCard(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={toggle} disabled={loading} aria-expanded={Boolean(card)}
        aria-controls={'card-' + id} className="min-h-11 rounded-lg border border-teal-700 px-3 text-sm font-bold text-teal-800">
        {card ? (he ? 'הסתרת מספר כרטיס' : 'Hide card number') : (he ? 'הצגת מספר כרטיס' : 'Reveal card number')}
      </button>
      <div id={'card-' + id} hidden={!card} dir="ltr" className="break-all text-sm">{card && card.number + ' · ' + card.expiry}</div>
      {error && <span className="text-sm text-red-800" role="alert">{he ? 'פרטי הכרטיס אינם זמינים כרגע.' : 'Card details are unavailable.'}</span>}
    </div>
  );
}
