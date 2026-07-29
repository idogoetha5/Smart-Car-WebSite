/**
 * Wraps the whole admin area, sign-in page included, purely to mark it
 * noindex. Only the dashboard root carried this before, so the login page
 * and every sub-page were indexable.
 *
 * This replaces the Disallow line that used to be in robots.txt: that file
 * is public, so naming the path there advertised it to exactly the people
 * who should not know it.
 */
export const metadata = {
  robots: { index: false, follow: false },
};

export default function AdminAreaLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
