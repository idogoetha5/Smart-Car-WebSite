import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from '@/lib/admin-auth';
import { createDriverTask, listDriverTasks } from '@/lib/driver-tasks-service';

async function requireAdmin() {
  const cookieStore = await cookies();
  return verifyAdminToken(cookieStore.get('admin_auth')?.value ?? '');
}

/** Lists tasks for the per-driver task panels in the admin "נהגים" page. */
export async function GET(request: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return listDriverTasks(request);
}

/** Creates a task (existing booking or a new phone booking). */
export async function POST(request: NextRequest) {
  if (!await requireAdmin()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return createDriverTask(request, 'admin');
}
