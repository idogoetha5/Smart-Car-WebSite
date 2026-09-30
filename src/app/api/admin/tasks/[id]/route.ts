import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { deleteCancelledTask, updateDriverTask } from '@/lib/driver-task-update';

/** Reassign, edit notes/address, or cancel a task. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  return updateDriverTask(request, id);
}

/** Delete a task that was already cancelled. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();
  if (!await verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id } = await params;
  return deleteCancelledTask(id);
}
