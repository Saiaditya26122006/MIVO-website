'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  published: boolean;
  in_stock: boolean;
  featured: boolean;
}

interface ProductsTableProps {
  initialProducts: Product[];
}

export function ProductsTable({ initialProducts }: ProductsTableProps) {
  const [products, setProducts] = useState(initialProducts);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async (productId: string, productName: string) => {
    // Confirm deletion
    const confirmed = confirm(
      `Are you sure you want to delete "${productName}"?\n\nThis action cannot be undone and will:\n- Remove the product from the catalog\n- Delete all associated images\n- Remove it from all orders (if any)\n\nType DELETE to confirm.`
    );

    if (!confirmed) return;

    // Double confirmation for safety
    const confirmText = prompt('Type DELETE in capital letters to confirm:');
    if (confirmText !== 'DELETE') {
      alert('Deletion cancelled - confirmation text did not match');
      return;
    }

    setDeletingId(productId);

    try {
      const supabase = createClient();

      // Delete product images from storage
      const product = products.find(p => p.id === productId);
      if (product && (product as any).images && Array.isArray((product as any).images)) {
        const images = (product as any).images as string[];
        if (images.length > 0) {
          console.log(`Deleting ${images.length} images from storage...`);
          const { error: storageError } = await supabase.storage
            .from('product-images')
            .remove(images);

          if (storageError) {
            console.error('Error deleting images:', storageError);
            // Continue with product deletion even if image deletion fails
          }
        }
      }

      // Delete product from database
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) {
        throw error;
      }

      // Update local state
      setProducts(products.filter(p => p.id !== productId));

      alert(`✅ Product "${productName}" deleted successfully`);

      // Refresh the page to update the list
      router.refresh();
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert(`❌ Failed to delete product: ${error.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (products.length === 0) {
    return (
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
    );
  }

  return (
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(product.id, product.name)}
                    disabled={deletingId === product.id}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    {deletingId === product.id ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
