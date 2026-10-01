const PALETTE = ['bg-[#2D5F5F]', 'bg-[#E8743B]', 'bg-[#3a7a7a]', 'bg-[#C24E17]', 'bg-[#1A3A3A]', 'bg-[#5a9e9e]'];

/** Initials in a coloured circle — the colour is stable per name. */
export default function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const clean = name.trim();
  const initials = clean ? clean.split(/\s+/).slice(0, 2).map((p) => p[0]).join('') : '?';
  let hash = 0;
  for (const ch of clean) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const color = clean ? PALETTE[hash % PALETTE.length] : 'bg-gray-300';
  const dims = size === 'sm' ? 'h-7 w-7 text-xs' : size === 'lg' ? 'h-14 w-14 text-xl' : 'h-10 w-10 text-sm';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full font-black text-white ${color} ${dims}`} aria-hidden="true">
      {initials}
    </span>
  );
}
