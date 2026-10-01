import { PageBar } from '@/components/app/Brand';
import BackButton from '@/components/app/BackButton';

export default function InnerScreenLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageBar back={<BackButton />} />
      {children}
    </>
  );
}
