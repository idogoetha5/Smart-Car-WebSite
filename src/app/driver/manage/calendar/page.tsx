'use client';

import DriversBoard from '@/components/drivers/DriversBoard';
import ManagerShell from '@/components/app/ManagerShell';

/** Branch-manager calendar: every task ahead by month or as a list; add a task on any day, with or without a driver. */
export default function ManagerCalendarPage() {
  return (
    <ManagerShell>
      <DriversBoard mode="manager" page="calendar" />
    </ManagerShell>
  );
}
