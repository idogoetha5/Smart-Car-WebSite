import { NextRequest, NextResponse } from 'next/server';
import { requireManagerOrAdmin } from '@/lib/driver-route-auth';
import { createDriverTask, listDriverTasks } from '@/lib/driver-tasks-service';

/** Branch manager: list driver tasks. */
export async function GET(request: NextRequest) {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return listDriverTasks(request);
}

/** Branch manager: create a task for a driver. */
export async function POST(request: NextRequest) {
  const { ok, managerId } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return createDriverTask(request, managerId ? `manager:${managerId}` : 'admin');
}
