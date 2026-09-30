import { NextResponse } from 'next/server';
import { requireManagerOrAdmin } from '@/lib/driver-route-auth';
import { deleteCancelledTask, updateDriverTask } from '@/lib/driver-task-update';

/** Branch manager: reassign, edit address, or cancel a task. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  return updateDriverTask(request, id);
}

/** Branch manager: delete a task that was already cancelled. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { ok } = await requireManagerOrAdmin();
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  return deleteCancelledTask(id);
}
