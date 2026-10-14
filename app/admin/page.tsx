import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { AdminNav } from '@/components/admin/AdminNav';

export default async function AdminDashboard() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  // Fetch dashboard stats
  const { count: productsCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true });

  const { count: publishedCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('published', true);

  const { count: ordersCount } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });

  const { count: quotesCount } = await supabase
    .from('custom_quotes')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'submitted');

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav user={user} />

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Welcome Header */}
        <div className="mb-12">
          <h1 className="text-5xl font-bold font-handwritten text-ink mb-3">
            Welcome back!
            <div className="relative inline-block ml-2">
              <span className="relative z-10">👋</span>
              <div className="absolute bottom-0 left-0 w-full h-3 bg-yellow opacity-60 -rotate-2"></div>
            </div>
          </h1>
          <p className="text-lg text-ink/70">
            Manage your products, orders, and custom quotes from the MIVO admin dashboard.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <StatCard
            title="Total Products"
            value={productsCount || 0}
            subtitle={`${publishedCount || 0} published`}
            icon="📦"
            color="lime"
          />
          <StatCard
            title="Orders"
            value={ordersCount || 0}
            subtitle="All time"
            icon="🛒"
            color="yellow"
          />
          <StatCard
            title="Pending Quotes"
            value={quotesCount || 0}
            subtitle="Awaiting review"
            icon="💬"
            color="orange"
          />
          <StatCard
            title="Revenue"
            value="₹0"
            subtitle="This month"
            icon="💰"
            color="lime"
          />
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-2xl border-2 border-ink/10 p-8">
          <h2 className="text-2xl font-bold text-ink mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ActionCard
              href="/admin/products/new"
              title="Add New Product"
              description="Upload STL and create a new product listing"
              icon="➕"
            />
            <ActionCard
              href="/admin/products"
              title="Manage Products"
              description="View and edit existing products"
              icon="📝"
            />
            <ActionCard
              href="/admin/orders"
              title="View Orders"
              description="Manage customer orders"
              icon="📋"
            />
            <ActionCard
              href="/admin/quotes"
              title="Custom Quotes"
              description="Review quote requests"
              icon="💡"
            />
            <ActionCard
              href="/explore"
              title="View Store"
              description="See your public storefront"
              icon="🏪"
            />
            <ActionCard
              href="/admin/settings"
              title="Settings"
              description="Configure your store"
              icon="⚙️"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: string;
  color: 'lime' | 'yellow' | 'orange';
}) {
  const bgColors = {
    lime: 'bg-lime/10',
    yellow: 'bg-yellow/10',
    orange: 'bg-orange/10',
  };

  const borderColors = {
    lime: 'border-lime/30',
    yellow: 'border-yellow/30',
    orange: 'border-orange/30',
  };

  return (
    <div className={`${bgColors[color]} ${borderColors[color]} border-2 rounded-xl p-6`}>
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{icon}</span>
      </div>
      <div className="text-3xl font-bold text-ink mb-1">{value}</div>
      <div className="text-sm font-semibold text-ink mb-1">{title}</div>
      <div className="text-xs text-ink/60">{subtitle}</div>
    </div>
  );
}

function ActionCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-cream hover:bg-white border-2 border-ink/10 hover:border-lime rounded-xl p-6 transition-all cursor-pointer group">
        <div className="flex items-start gap-4">
          <span className="text-3xl group-hover:scale-110 transition-transform">{icon}</span>
          <div className="flex-1">
            <h3 className="font-bold text-ink group-hover:text-lime transition-colors mb-1">
              {title}
            </h3>
            <p className="text-sm text-ink/60">{description}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}
