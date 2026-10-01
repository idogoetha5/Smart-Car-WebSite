'use client';

import { useState } from 'react';
import { CalendarDays, FileCheck2, LayoutDashboard, Plus, Users } from 'lucide-react';
import { ToastProvider } from '@/components/ui/AppToast';
import { ManagerDataProvider, useManager } from './ManagerData';
import TodayView from './TodayView';
import CalendarView from './CalendarView';
import DriversView from './DriversView';
import DocumentsView from './DocumentsView';
import ManagersSection from './ManagersSection';
import TaskSheet from './TaskSheet';
import NewTaskSheet from './NewTaskSheet';

const TABS = [
  { key: 'today', label: 'היום', icon: LayoutDashboard },
  { key: 'calendar', label: 'יומן', icon: CalendarDays },
  { key: 'drivers', label: 'נהגים', icon: Users },
  { key: 'docs', label: 'מסמכים', icon: FileCheck2 },
] as const;

function Inner() {
  const { openNewTask } = useManager();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('today');
  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-8" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/[0.04]" role="tablist">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-black transition ${tab === key ? 'bg-[#2D5F5F] text-white' : 'text-gray-500 hover:text-gray-800'}`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <button onClick={() => openNewTask()} className="flex min-h-11 items-center gap-2 rounded-2xl bg-[#E8743B] px-5 text-sm font-black text-white shadow-sm shadow-orange-200 hover:bg-[#d4632a]">
          <Plus className="h-4 w-4" aria-hidden="true" />
          משימה חדשה
        </button>
      </div>
      {tab === 'today' && <TodayView />}
      {tab === 'calendar' && <CalendarView />}
      {tab === 'drivers' && (
        <>
          <DriversView />
          <ManagersSection />
        </>
      )}
      {tab === 'docs' && <DocumentsView />}
      <TaskSheet />
      <NewTaskSheet />
    </div>
  );
}

/** The manager app's pages as tabs inside the admin panel ("נהגים"), with admin APIs and the managers list. */
export default function ManagerWorkspace() {
  return (
    <ToastProvider>
      <ManagerDataProvider mode="admin">
        <Inner />
      </ManagerDataProvider>
    </ToastProvider>
  );
}
