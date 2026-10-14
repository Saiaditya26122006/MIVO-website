import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { ProductsTable } from '@/components/admin/ProductsTable';

export default async function ProductsListPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  // Fetch all products
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold font-handwritten text-ink mb-2">Products</h1>
            <p className="text-lg text-ink/70">Manage your product catalogue</p>
          </div>
          <Link href="/admin/products/new">
            <Button variant="accent" size="lg" className="rounded-xl font-bold">
              + Add New Product
            </Button>
          </Link>
        </div>

        {/* Products Table */}
        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-red-800 font-medium">Failed to load products: {error.message}</p>
          </div>
        )}

        <ProductsTable initialProducts={products || []} />
    </div>
  );
}
