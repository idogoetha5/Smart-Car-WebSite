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
    <Sheet
      open={newTask.open}
      onClose={closeNewTask}
      title={newTask.today ? 'משימה להיום' : newTask.type === 'wash' ? 'שליחה לשטיפה' : newTask.type === 'service' ? 'טיפול ברכב' : fixed ? `משימה חדשה ל${fixed.name}` : 'משימה חדשה'}
    >
      <DriverTaskForm
        key={`${newTask.date ?? ''}-${newTask.driverId ?? ''}-${newTask.type ?? ''}-${newTask.vehicleId ?? ''}-${newTask.today ? 'today' : ''}-${newTask.open}`}
        defaultType={newTask.type}
        defaultVehicleId={newTask.vehicleId}
        todayTask={newTask.today}
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
          toast('המשימה נשלחה');
        }}
      />
    </Sheet>
  );
}
