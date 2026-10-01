'use client';

import { useState } from 'react';
import { CalendarDays, Car, FileCheck2, LayoutDashboard, Plus, Users } from 'lucide-react';
import { ToastProvider } from '@/components/ui/AppToast';
import { ManagerDataProvider, useManager } from './ManagerData';
import TodayView from './TodayView';
import CalendarView from './CalendarView';
import DriversView from './DriversView';
import VehiclesView from './VehiclesView';
import DocumentsView from './DocumentsView';
import ManagersSection from './ManagersSection';
import TaskSheet from './TaskSheet';
import NewTaskSheet from './NewTaskSheet';
import { QUICK_ACTIONS } from './QuickActions';

const TABS = [
  { key: 'today', label: 'היום', icon: LayoutDashboard },
  { key: 'calendar', label: 'יומן', icon: CalendarDays },
  { key: 'vehicles', label: 'רכבים', icon: Car },
  { key: 'drivers', label: 'נהגים', icon: Users },
  { key: 'docs', label: 'מסמכים', icon: FileCheck2 },
] as const;

function Inner() {
  const { openNewTask } = useManager();
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('today');
  return (
    <div className="mx-auto w-full max-w-5xl p-4 sm:p-8" dir="rtl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm ring-1 ring-black/[0.04]" role="tablist">
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
        <div className="flex flex-wrap gap-2">
          {QUICK_ACTIONS.map(({ key, title, icon: Icon, opts }) => (
            <button key={key} onClick={() => openNewTask(opts)} className="flex min-h-11 items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-[#0D2B2B] ring-1 ring-black/[0.06] hover:bg-[#eef6f6]">
              <Icon className="h-4 w-4 text-[#2D5F5F]" aria-hidden="true" />
              {title}
            </button>
          ))}
          <button onClick={() => openNewTask()} className="flex min-h-11 items-center gap-2 rounded-2xl bg-[#E8743B] px-5 text-sm font-black text-white shadow-sm shadow-orange-200 hover:bg-[#d4632a]">
            <Plus className="h-4 w-4" aria-hidden="true" />
            משימה חדשה
          </button>
        </div>
      </div>
      {tab === 'today' && <TodayView />}
      {tab === 'calendar' && <CalendarView />}
      {tab === 'vehicles' && <VehiclesView />}
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
