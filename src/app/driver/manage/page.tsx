'use client';

import DriversBoard from '@/components/drivers/DriversBoard';
import ManagerShell from '@/components/app/ManagerShell';

/**
 * Branch-manager app (smartcar.co.il/manager → here): the drivers + tasks
 * board, without admin access. Managers are added in the admin under
 * "נהגים → מנהלים" and log in at /driver/manager-login.
 */
export default function BranchManagerPage() {
  return (
    <ManagerShell>
      <DriversBoard mode="manager" />
    </ManagerShell>
  );
}
