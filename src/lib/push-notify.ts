import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { bookingLicensePlate, bookingVehicleName } from '@/lib/booking-vehicle';
import {
  taskAddressMessage,
  taskAssignedMessage,
  taskCancelledMessage,
  taskMovedToYouMessage,
  taskRemovedMessage,
  taskRescheduledMessage,
  urgentAssignedMessage,
  urgentClaimedMessage,
  urgentOpenMessage,
  type TaskSummary,
} from '@/lib/push-messages';
import { sendPushToDrivers, sendPushToManagers } from '@/lib/push';
import { serviceReasonLabel, serviceTitle } from '@/lib/service-task';

/**
 * Glue between task changes and phone notifications: loads what a task is
 * (customer, day, time, address) and tells the right driver what changed.
 */

const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' });

export interface TaskSnapshot {
  id: string;
  urgent: boolean;
  status: 'open' | 'done' | 'cancelled';
  driverId: string | null;
  summary: TaskSummary;
  bookingId: string | null;
}

type Row = {
  id: string;
  urgent?: boolean | null;
  type: 'pickup' | 'return' | 'service';
  scheduled_at?: string | null;
  scheduled_time?: string | null;
  location?: string | null;
  service_kind?: string | null;
  service_reason?: string | null;
  service_place?: string | null;
  custom_vehicle_name?: string | null;
  custom_license_plate?: string | null;
  car?: { make: string; model: string; license_plate: string | null } | null;
  status: 'open' | 'done' | 'cancelled';
  assigned_driver_id: string | null;
  booking_id: string | null;
  booking: {
    customer_name: string;
    pickup_date: string;
    dropoff_date: string;
    pickup_time: string | null;
    return_time: string | null;
    pickup_location: string | null;
    dropoff_location: string | null;
    custom_vehicle_name: string | null;
    custom_license_plate: string | null;
    vehicle: { make: string; model: string; license_plate: string | null } | null;
  } | null;
};

function toSnapshot(row: Row): TaskSnapshot {
  if (row.type === 'service') {
    const car = { vehicle: row.car ?? null, custom_vehicle_name: row.custom_vehicle_name, custom_license_plate: row.custom_license_plate };
    const plate = bookingLicensePlate(car);
    return {
      id: row.id,
      urgent: Boolean(row.urgent),
      status: row.status,
      driverId: row.assigned_driver_id,
      bookingId: null,
      summary: {
        type: 'service',
        customerName: serviceTitle(row.service_kind, row.service_place),
        reason: serviceReasonLabel(row.service_reason) || null,
        day: row.scheduled_at ? dayFormatter.format(new Date(row.scheduled_at)) : null,
        time: row.scheduled_time ? row.scheduled_time.slice(0, 5) : null,
        address: row.location || null,
        vehicle: [bookingVehicleName(car), plate !== '—' ? plate : ''].filter(Boolean).join(' '),
      },
    };
  }
  const b = row.booking;
  const date = row.type === 'pickup' ? b?.pickup_date : b?.dropoff_date;
  const time = row.type === 'pickup' ? b?.pickup_time : b?.return_time;
  const location = row.type === 'pickup' ? b?.pickup_location : b?.dropoff_location;
  const plate = bookingLicensePlate(b);
  return {
    id: row.id,
    urgent: Boolean(row.urgent),
    status: row.status,
    driverId: row.assigned_driver_id,
    bookingId: row.booking_id,
    summary: {
      type: row.type,
      customerName: b?.customer_name ?? '',
      day: date && !Number.isNaN(new Date(date).getTime()) ? dayFormatter.format(new Date(date)) : null,
      time: time ? time.slice(0, 5) : null,
      address: location && location !== 'לא צוין' ? location : null,
      vehicle: [bookingVehicleName(b), plate !== '—' ? plate : ''].filter(Boolean).join(' '),
    },
  };
}

export async function loadTaskSnapshot(taskId: string): Promise<TaskSnapshot | null> {
  const { data, error } = await createAdminClient()
    .from('driver_tasks')
    .select(
      'id, type, status, urgent, assigned_driver_id, booking_id, scheduled_at, scheduled_time, location, service_kind, service_reason, service_place, custom_vehicle_name, custom_license_plate, car:vehicles(make, model, license_plate), booking:bookings(customer_name, pickup_date, dropoff_date, pickup_time, return_time, pickup_location, dropoff_location, custom_vehicle_name, custom_license_plate, vehicle:vehicles(make, model, license_plate))'
    )
    .eq('id', taskId)
    .maybeSingle<Row>();
  if (error || !data) {
    if (error) console.error('[push-notify] task lookup failed:', error.message);
    return null;
  }
  return toSnapshot(data);
}

/** A new task was created and assigned (optionally with its return planned). */
export async function notifyTaskCreated(taskId: string, returnTaskId?: string | null): Promise<void> {
  const task = await loadTaskSnapshot(taskId);
  if (!task) return;
  if (task.urgent) {
    if (task.driverId) {
      await sendPushToDrivers([task.driverId], urgentAssignedMessage(task.summary, new Date()));
    } else {
      // Nobody chosen: offer it to every active driver.
      const { data } = await createAdminClient().from('drivers').select('id').eq('active', true).eq('role', 'driver');
      await sendPushToDrivers((data ?? []).map((d) => d.id), urgentOpenMessage(task.summary, new Date()));
    }
    return;
  }
  if (!task.driverId) return;
  const ret = returnTaskId ? await loadTaskSnapshot(returnTaskId) : null;
  const now = new Date();
  await sendPushToDrivers([task.driverId], taskAssignedMessage(task.summary, now, ret ? { day: ret.summary.day, time: ret.summary.time } : null));
  // Return task assigned to someone else than the pickup — tell them too.
  if (ret?.driverId && ret.driverId !== task.driverId) {
    await sendPushToDrivers([ret.driverId], taskAssignedMessage(ret.summary, now));
  }
}

/** Compares a task before/after a manager's edit and notifies whoever is affected. */
export async function notifyTaskChanged(before: TaskSnapshot, changes: { reassigned: boolean; rescheduled: boolean; addressChanged: boolean }): Promise<void> {
  const after = await loadTaskSnapshot(before.id);
  if (!after) return;
  const now = new Date();

  if (after.status === 'cancelled' && before.status !== 'cancelled') {
    await sendPushToDrivers([before.driverId], taskCancelledMessage(before.summary, now));
    return;
  }
  if (after.status === 'cancelled') return;

  if (changes.reassigned && before.driverId !== after.driverId) {
    await Promise.all([
      before.driverId ? sendPushToDrivers([before.driverId], taskRemovedMessage(before.summary, now)) : null,
      after.driverId ? sendPushToDrivers([after.driverId], taskMovedToYouMessage(after.summary, now)) : null,
    ]);
    return;
  }
  if (!after.driverId || after.status !== 'open') return;

  if (changes.rescheduled && (before.summary.day !== after.summary.day || before.summary.time !== after.summary.time)) {
    await sendPushToDrivers([after.driverId], taskRescheduledMessage(after.summary, now));
  } else if (changes.addressChanged && before.summary.address !== after.summary.address) {
    await sendPushToDrivers([after.driverId], taskAddressMessage(after.summary));
  }
}

/**
 * Runs a notification job after the response is sent (Next's `after`), so a
 * slow push service never delays the manager's screen. Falls back to a
 * fire-and-forget call outside a request (e.g. tests).
 */
export function inBackground(job: () => Promise<void>): void {
  const run = () => job().catch((err) => console.error('[push-notify] job failed:', err));
  try {
    after(run);
  } catch {
    void run();
  }
}

/** A driver took an open urgent task — tell the managers. */
export async function notifyUrgentClaimed(taskId: string, driverName: string): Promise<void> {
  const task = await loadTaskSnapshot(taskId);
  if (!task) return;
  await sendPushToManagers(urgentClaimedMessage(task.summary, driverName, new Date()));
}
