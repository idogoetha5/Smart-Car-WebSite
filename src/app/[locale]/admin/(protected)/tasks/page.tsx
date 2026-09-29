import { redirect } from 'next/navigation';

export default async function AdminTasksRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(`/${locale}/admin/drivers`);
}
