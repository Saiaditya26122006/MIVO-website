import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function OrdersPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold font-handwritten text-ink mb-2">Orders</h1>
        <p className="text-lg text-ink/70 mb-8">Manage customer orders</p>

        <div className="bg-white rounded-2xl border-2 border-ink/10 p-12 text-center">
          <p className="text-ink/60">Order management coming soon...</p>
        </div>
    </div>
  );
}
