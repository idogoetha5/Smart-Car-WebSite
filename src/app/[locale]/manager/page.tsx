import { redirect } from 'next/navigation';

/** Short link for branch managers: smartcar.co.il/manager */
export default function ManagerShortLink() {
  redirect('/driver/manage');
}
