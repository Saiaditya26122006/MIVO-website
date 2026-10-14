import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

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

        {!products || products.length === 0 ? (
          <div className="bg-white rounded-2xl border-2 border-ink/10 p-12 text-center">
            <svg
              className="w-20 h-20 mx-auto mb-4 text-ink/20"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <h3 className="text-2xl font-bold text-ink mb-2">No products yet</h3>
            <p className="text-ink/60 mb-6">Get started by adding your first product</p>
            <Link href="/admin/products/new">
              <Button variant="accent" size="lg" className="rounded-xl font-bold">
                Create Your First Product
              </Button>
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border-2 border-ink/10 overflow-hidden">
            <table className="w-full">
              <thead className="bg-cream border-b-2 border-ink/10">
                <tr>
                  <th className="text-left px-6 py-4 text-sm font-bold text-ink uppercase tracking-wider">
                    Product
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-ink uppercase tracking-wider">
                    Category
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-ink uppercase tracking-wider">
                    Price
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-bold text-ink uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-bold text-ink uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink/5">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-cream/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-ink">{product.name}</p>
                        <p className="text-sm text-ink/60 line-clamp-1">{product.description}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-lime/10 text-ink border border-lime/20">
                        {product.category}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-ink">₹{product.price}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        {product.published ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-yellow-700">
                            <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                            Draft
                          </span>
                        )}
                        {!product.in_stock && (
                          <span className="text-xs text-red-600 font-medium">Out of Stock</span>
                        )}
                        {product.featured && (
                          <span className="text-xs text-lime font-medium">Featured</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/product/${product.id}`} target="_blank">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                        <Link href={`/admin/products/${product.id}/edit`}>
                          <Button variant="secondary" size="sm">
                            Edit
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
    </div>
  );
}
