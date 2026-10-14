'use client';

import { useState, use, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { ModelViewer } from '@/components/3d/ModelViewer';
import { createClient } from '@/lib/supabase/client';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductPage({ params }: PageProps) {
  const { id } = use(params);
  const supabase = createClient();

  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'3d' | 'images'>('3d');

  useEffect(() => {
    async function fetchProduct() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .eq('published', true)
        .single();

      if (error || !data) {
        console.error('Error fetching product:', error);
        setProduct(null);
      } else {
        setProduct(data);
      }
      setLoading(false);
    }

    fetchProduct();
  }, [id, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink/70 font-medium">Loading product...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-ink mb-4">404</h1>
          <p className="text-xl text-ink/70 mb-8">Product not found</p>
          <Link href="/explore">
            <Button variant="accent">Back to Explore</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleAddToCart = () => {
    // TODO: Implement cart functionality
    alert(`Added ${quantity}x ${product.name} to cart`);
  };

  const handleBuyNow = () => {
    // TODO: Implement direct checkout
    alert('Redirecting to checkout...');
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-ink/60">
          <Link href="/" className="hover:text-ink">
            Home
          </Link>
          <span className="mx-2">/</span>
          <Link href="/explore" className="hover:text-ink">
            Explore
          </Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Product Viewer */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Tab Switcher */}
            <div className="flex gap-4 mb-4">
              <button
                onClick={() => setActiveTab('3d')}
                className={`px-4 py-2 border-2 transition-all ${
                  activeTab === '3d'
                    ? 'bg-ink text-cream border-ink'
                    : 'bg-cream text-ink border-ink/20 hover:border-ink/40'
                }`}
              >
                3D View
              </button>
              <button
                onClick={() => setActiveTab('images')}
                className={`px-4 py-2 border-2 transition-all ${
                  activeTab === 'images'
                    ? 'bg-ink text-cream border-ink'
                    : 'bg-cream text-ink border-ink/20 hover:border-ink/40'
                }`}
              >
                Photos
              </button>
            </div>

            {/* 3D Viewer or Image Gallery */}
            <div className="aspect-square bg-cream/50 border-2 border-ink/10 overflow-hidden relative">
              {activeTab === '3d' && product.model_file ? (
                <ModelViewer
                  modelUrl={`https://fuqjvxcyonuztfsepecb.supabase.co/storage/v1/object/public/product-stl-files/${product.model_file}`}
                  className="w-full h-full"
                />
              ) : activeTab === 'images' && product.images && product.images.length > 0 ? (
                <Image
                  src={`https://fuqjvxcyonuztfsepecb.supabase.co/storage/v1/object/public/product-images/${product.images[0]}`}
                  alt={product.name}
                  fill
                  className="object-contain p-8"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-6xl">
                  📦
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {activeTab === 'images' && (
              <div className="grid grid-cols-4 gap-4 mt-4">
                {[1, 2, 3, 4].map((i) => (
                  <button
                    key={i}
                    className="aspect-square bg-cream/50 border-2 border-ink/10 hover:border-lime transition-all"
                  >
                    <span className="text-2xl">📷</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Right: Product Details */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="space-y-6"
          >
            {/* Header */}
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm text-ink/60 uppercase tracking-wide">
                  {product.category}
                </span>
                {product.featured && (
                  <span className="bg-lime text-ink px-2 py-1 text-xs font-semibold">
                    Featured
                  </span>
                )}
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-ink mb-4">
                {product.name}
              </h1>
              <div className="flex items-baseline gap-4">
                <span className="text-4xl font-bold text-ink">
                  ₹{product.price}
                </span>
                {!product.in_stock && (
                  <span className="text-red-600 font-semibold">Out of Stock</span>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="border-t border-ink/10 pt-6">
              <p className="text-lg text-ink/80 leading-relaxed">
                {product.description}
              </p>
            </div>

            {/* Specifications */}
            {product.specifications && (
              <div className="border-t border-ink/10 pt-6">
                <h3 className="font-semibold text-ink mb-3">Specifications</h3>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-ink/60">Material</dt>
                    <dd className="font-medium text-ink">{product.specifications?.Material || 'Standard'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink/60">Dimensions</dt>
                    <dd className="font-medium text-ink">
                      {product.specifications?.Dimensions || 'See description'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}

            {/* Color Selection */}
            {product.specifications?.Color && (
              <div className="border-t border-ink/10 pt-6">
                <h3 className="font-semibold text-ink mb-3">
                  Color: <span className="font-normal">{selectedColor}</span>
                </h3>
                <div className="flex flex-wrap gap-3">
                  {[product.specifications?.Color].filter(Boolean).map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`px-4 py-2 border-2 transition-all ${
                        selectedColor === color
                          ? 'bg-ink text-cream border-ink'
                          : 'bg-cream text-ink border-ink/20 hover:border-ink/40'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity */}
            <div className="border-t border-ink/10 pt-6">
              <h3 className="font-semibold text-ink mb-3">Quantity</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-10 h-10 border-2 border-ink/20 hover:border-ink flex items-center justify-center transition-all"
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="text-xl font-semibold text-ink w-12 text-center">
                  {quantity}
                </span>
                <button
                  onClick={() => setQuantity(quantity + 1)}
                  className="w-10 h-10 border-2 border-ink/20 hover:border-ink flex items-center justify-center transition-all"
                >
                  +
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-ink/10 pt-6 space-y-3">
              <Button
                variant="accent"
                size="lg"
                className="w-full"
                onClick={handleBuyNow}
                disabled={!product.in_stock}
              >
                Buy Now
              </Button>
              <Button
                variant="secondary"
                size="lg"
                className="w-full"
                onClick={handleAddToCart}
                disabled={!product.in_stock}
              >
                Add to Cart
              </Button>

              {/* WhatsApp Order */}
              <Button
                variant="ghost"
                size="lg"
                className="w-full"
                onClick={() =>
                  window.open(
                    `https://wa.me/YOUR_PHONE?text=Hi, I'm interested in ${product.name}`,
                    '_blank'
                  )
                }
              >
                <span className="mr-2">💬</span>
                Order via WhatsApp
              </Button>
            </div>

            {/* Additional Info */}
            <div className="bg-lime/10 border-2 border-lime/20 p-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <span className="text-ink">High-quality 3D printing</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <span className="text-ink">Fast delivery</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <span className="text-ink">Custom colors available</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Related Products */}
        <section className="mt-24">
          <h2 className="text-3xl font-bold text-ink mb-8">
            You might also like
          </h2>
          <div className="text-center text-ink/60 py-12">
            Related products will be displayed here
          </div>
        </section>
      </div>
    </div>
  );
}
