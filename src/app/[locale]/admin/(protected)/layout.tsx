import AdminSidebar from '@/components/layout/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `flex-col` below md so the compact bar sits above the content rather
    // than beside it; `md:flex-row` restores the desktop rail.
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <AdminSidebar />
      {/* min-w-0 is the whole fix for the sideways scroll: without it a flex
          child refuses to shrink below the width of its widest content, so
          one wide table pushed the entire page off-screen. `max-w-full`
          keeps that true even when a child sets its own width. */}
      <div className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden">
        {children}
      </div>
    </div>
  );
}
