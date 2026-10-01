'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApiList } from '@/lib/swr';
import { byWhen, israelClock, israelDate, taskWhen } from '@/lib/task-schedule';
import { useToast } from '@/components/ui/AppToast';
import type { RentalAlert } from '@/lib/rental-alerts';
import type { ManagerDriver, ManagerTask, SignedJob } from './types';

const REFRESH_MS = 60_000;

export interface NewTaskOptions {
  date?: string;
  driverId?: string;
  type?: 'pickup' | 'return' | 'service' | 'wash';
  vehicleId?: string;
  /** "משימה להיום": urgent, for the next hours, to one driver or the first who takes it. */
  today?: boolean;
}

export type AlertKind = 'urgent' | 'late' | 'unassigned' | 'unsigned';

interface ManagerData {
  isAdmin: boolean;
  tasksApi: string;
  peopleApi: string;
  bookingsApi: string;
  loading: boolean;
  drivers: ManagerDriver[];
  activeDrivers: ManagerDriver[];
  managers: ManagerDriver[];
  driverName: (id: string | null | undefined) => string;
  tasks: ManagerTask[];
  liveTasks: ManagerTask[];
  signedJobs: SignedJob[];
  signedById: Map<string, SignedJob>;
  now: number;
  today: string;
  tomorrow: string;
  alerts: Record<AlertKind, ManagerTask[]>;
  rentalAlerts: RentalAlert[];
  setRentalAlertResolved: (alert: RentalAlert, resolved: boolean) => Promise<boolean>;
  refresh: () => void;
  patchTask: (task: ManagerTask, body: Record<string, unknown>, success?: string) => Promise<boolean>;
  deleteTask: (task: ManagerTask) => Promise<boolean>;
  mutatePeople: ReturnType<typeof useApiList<ManagerDriver>>['mutate'];
  openNewTask: (opts?: NewTaskOptions) => void;
  newTask: { open: boolean } & NewTaskOptions;
  closeNewTask: () => void;
  openTask: (id: string) => void;
  openTaskId: string | null;
  closeTask: () => void;
}

const Ctx = createContext<ManagerData | null>(null);

export function useManager(): ManagerData {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useManager outside ManagerDataProvider');
  return ctx;
}

/** Loads drivers, tasks and signed jobs once for every manager page, refreshing quietly every minute. */
export function ManagerDataProvider({ mode, children }: { mode: 'admin' | 'manager'; children: ReactNode }) {
  const isAdmin = mode === 'admin';
  const tasksApi = isAdmin ? '/api/admin/tasks' : '/api/driver/manage/tasks';
  const peopleApi = isAdmin ? '/api/admin/drivers' : '/api/driver/manage/drivers';
  const bookingsApi = isAdmin ? '/api/bookings' : '/api/driver/manage/bookings';
  const live = { refreshInterval: REFRESH_MS, revalidateOnFocus: true };
  const toast = useToast();

  const { items: people, isLoading: peopleLoading, mutate: mutatePeople } = useApiList<ManagerDriver>(peopleApi, live);
  const { items: tasks, isLoading: tasksLoading, mutate: mutateTasks } = useApiList<ManagerTask>(tasksApi, live);
  const { items: signedJobs, mutate: mutateSigned } = useApiList<SignedJob>(isAdmin ? '/api/admin/inspections/signed' : '/api/driver/manage/inspections', live);
  const { items: rentalAlerts, mutate: mutateRentalAlerts } = useApiList<RentalAlert>('/api/driver/manage/rental-alerts', live);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  const today = israelDate(now);
  const tomorrow = israelDate(now, 1);

  const drivers = useMemo(() => people.filter((p) => p.role !== 'manager'), [people]);
  const managers = useMemo(() => people.filter((p) => p.role === 'manager'), [people]);
  const activeDrivers = useMemo(() => drivers.filter((d) => d.active), [drivers]);
  const names = useMemo(() => new Map(people.map((p) => [p.id, p.name])), [people]);
  const driverName = useCallback((id: string | null | undefined) => (id ? names.get(id) ?? '' : ''), [names]);
  const liveTasks = useMemo(() => tasks.filter((t) => t.status !== 'cancelled').sort(byWhen), [tasks]);
  const signedById = useMemo(() => new Map(signedJobs.map((j) => [j.id, j])), [signedJobs]);

  const alerts = useMemo(() => {
    const clock = israelClock(now);
    const late: ManagerTask[] = [];
    const unassigned: ManagerTask[] = [];
    const unsigned: ManagerTask[] = [];
    const urgent: ManagerTask[] = [];
    for (const task of liveTasks) {
      const { day, time } = taskWhen(task);
      if (task.urgent && task.status === 'open' && day && day <= today) urgent.push(task);
      if (task.status === 'open' && day && (day < today || (day === today && time !== null && time < clock))) late.push(task);
      else if (task.status === 'open' && !task.assigned_driver_id && day && day <= tomorrow) unassigned.push(task);
      if (task.inspection?.status === 'awaiting_signature') unsigned.push(task);
    }
    return { urgent, late, unassigned, unsigned };
  }, [liveTasks, now, today, tomorrow]);

  const refresh = useCallback(() => {
    void mutatePeople();
    void mutateTasks();
    void mutateSigned();
    void mutateRentalAlerts();
  }, [mutatePeople, mutateTasks, mutateSigned, mutateRentalAlerts]);

  const setRentalAlertResolved = useCallback(
    async (alert: RentalAlert, resolved: boolean) => {
      const res = await fetch(`/api/driver/manage/rental-alerts/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      });
      if (!res.ok) {
        toast('לא הצלחנו לעדכן את החריגה. נסו שוב.', false);
        return false;
      }
      toast(resolved ? 'החריגה סומנה כטופלה' : 'החריגה הוחזרה לטיפול');
      void mutateRentalAlerts();
      return true;
    },
    [mutateRentalAlerts, toast]
  );

  const patchTask = useCallback(
    async (task: ManagerTask, body: Record<string, unknown>, success?: string) => {
      const res = await fetch(`${tasksApi}/${task.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast(json?.error || 'השמירה נכשלה', false);
        return false;
      }
      if (success) toast(success);
      void mutateTasks();
      return true;
    },
    [tasksApi, mutateTasks, toast]
  );

  const deleteTask = useCallback(
    async (task: ManagerTask) => {
      const res = await fetch(`${tasksApi}/${task.id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast('המחיקה נכשלה', false);
        return false;
      }
      toast('המשימה נמחקה');
      void mutateTasks((current) => (current ?? []).filter((t) => t.id !== task.id), { revalidate: false });
      return true;
    },
    [tasksApi, mutateTasks, toast]
  );

  const [newTask, setNewTask] = useState<{ open: boolean } & NewTaskOptions>({ open: false });
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const value: ManagerData = {
    isAdmin,
    tasksApi,
    peopleApi,
    bookingsApi,
    loading: peopleLoading || tasksLoading,
    drivers,
    activeDrivers,
    managers,
    driverName,
    tasks,
    liveTasks,
    signedJobs,
    signedById,
    now,
    today,
    tomorrow,
    alerts,
    rentalAlerts,
    setRentalAlertResolved,
    refresh,
    patchTask,
    deleteTask,
    mutatePeople,
    openNewTask: (opts) => setNewTask({ open: true, ...opts }),
    newTask,
    closeNewTask: () => setNewTask({ open: false }),
    openTask: setOpenTaskId,
    openTaskId,
    closeTask: () => setOpenTaskId(null),
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
