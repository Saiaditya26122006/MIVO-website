import { createClient } from '@/lib/supabase/server';
import { AdminNav } from '@/components/admin/AdminNav';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // If no user, just render children (login page will handle it)
  if (!user) {
    return <>{children}</>;
  }

  // Authenticated users get the full admin layout
  return (
    <div className="min-h-screen bg-cream">
      <AdminNav user={user} />
      {children}
    </div>
  );
}
