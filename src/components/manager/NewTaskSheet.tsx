'use client';

import Sheet from '@/components/ui/Sheet';
import DriverTaskForm from '@/components/admin/DriverTaskForm';
import { useToast } from '@/components/ui/AppToast';
import { useManager } from './ManagerData';

/** "משימה חדשה" from anywhere in the manager app (header button, calendar day, driver card). */
export default function NewTaskSheet() {
  const { newTask, closeNewTask, activeDrivers, tasksApi, bookingsApi, refresh } = useManager();
  const toast = useToast();
  const fixed = newTask.driverId ? activeDrivers.find((d) => d.id === newTask.driverId) ?? null : null;
  return (
    <Sheet open={newTask.open} onClose={closeNewTask} title={fixed ? `משימה חדשה ל${fixed.name}` : 'משימה חדשה'}>
      <DriverTaskForm
        key={`${newTask.date ?? ''}-${newTask.driverId ?? ''}-${newTask.open}`}
        embedded
        driver={fixed}
        drivers={activeDrivers}
        defaultDate={newTask.date}
        tasksApi={tasksApi}
        bookingsApi={bookingsApi}
        onCancel={closeNewTask}
        onCreated={() => {
          closeNewTask();
          refresh();
          toast('המשימה נוצרה');
        }}
      />
    </Sheet>
  );
}
