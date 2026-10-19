import AdminSidebar from '@/components/layout/AdminSidebar';
import AdminAppSetup from '@/components/admin/AdminAppSetup';
import { ToastProvider } from '@/components/ui/AppToast';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // `flex-col` below md so the compact bar sits above the content rather
    // than beside it; `md:flex-row` restores the desktop rail.
    <div className="smartcar-admin flex min-h-screen flex-col md:flex-row">
      <AdminAppSetup />
      <AdminSidebar />
      {/* min-w-0 is the whole fix for the sideways scroll: without it a flex
          child refuses to shrink below the width of its widest content, so
          one wide table pushed the entire page off-screen. `max-w-full`
          keeps that true even when a child sets its own width. */}
      <div className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom))] text-base [&_input]:text-base [&_select]:text-base [&_textarea]:text-base md:pb-0">
        <ToastProvider>{children}</ToastProvider>
      </div>
    </div>
  );
}
