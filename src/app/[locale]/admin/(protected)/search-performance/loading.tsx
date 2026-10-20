export default function LoadingSearchPerformance() {
  return <div role="status" aria-label="Loading search performance" className="mx-auto max-w-6xl animate-pulse p-4 sm:p-8"><div className="h-52 rounded-3xl bg-[#DDEDEC]" /><div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[1, 2, 3, 4].map((key) => <div key={key} className="h-24 rounded-2xl bg-slate-100" />)}</div><div className="h-96 rounded-3xl bg-slate-100" /></div>;
}
