'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
};

export default function ExplorePage() {
  const supabase = createClient();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price-asc' | 'price-desc'>('name');

  // Fetch products from database
  useEffect(() => {
    async function fetchProducts() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('published', true)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
      } else {
        setProducts(data || []);
      }
      setLoading(false);
    }

    fetchProducts();
  }, [supabase]);

  // Compute categories from products
  const categories = useMemo(() => {
    const categoryMap = new Map<string, { id: string; name: string; productCount: number }>();

    products.forEach((product) => {
      const cat = product.category || 'other';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          id: cat,
          name: cat.charAt(0).toUpperCase() + cat.slice(1),
          productCount: 0,
        });
      }
      categoryMap.get(cat)!.productCount++;
    });

    return Array.from(categoryMap.values());
  }, [products]);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter((p) => p.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          p.description.toLowerCase().includes(query) ||
          p.category.toLowerCase().includes(query) ||
          p.tags?.some((tag: string) => tag.toLowerCase().includes(query))
      );
    }

    // Sort
    if (sortBy === 'name') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'price-asc') {
      filtered = [...filtered].sort((a, b) => a.price - b.price);
    } else if (sortBy === 'price-desc') {
      filtered = [...filtered].sort((a, b) => b.price - a.price);
    }

    return filtered;
  }, [selectedCategory, searchQuery, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink/70 font-medium">Loading products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Header - Cream background with handwritten style */}
      <section className="bg-cream border-b border-ink/10 py-16">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col md:flex-row md:items-end md:justify-between gap-6"
          >
            <div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold font-handwritten text-ink mb-3">
                Ready-to-Order
                <br />
                Models
                <div className="relative inline-block ml-3">
                  <span className="relative z-10">.</span>
                  <div className="absolute bottom-0 left-0 w-full h-3 bg-yellow opacity-60 -rotate-2"></div>
                </div>
              </h1>
              <p className="text-lg text-ink/70 max-w-2xl">
                Precision-engineered 3D printed parts for robotics, electronics, and custom projects
              </p>
            </div>
            <div className="flex items-center gap-3 text-sm text-ink/60">
              <svg className="w-5 h-5 text-lime" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{products.length} products available</span>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Filters & Search */}
        <div className="mb-12 space-y-6">
          {/* Search Bar */}
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <input
                type="search"
                placeholder="Search by name, category, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-5 py-4 pr-12 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all placeholder:text-ink/40"
              />
              <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-ink/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-5 py-4 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all font-medium"
            >
              <option value="name">Sort by Name</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-6 py-3 rounded-full font-semibold transition-all border-2 ${
                selectedCategory === 'all'
                  ? 'bg-lime text-ink border-lime shadow-md'
                  : 'bg-white text-ink/70 border-ink/10 hover:border-lime/50 hover:bg-lime/5'
              }`}
            >
              All Products
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-6 py-3 rounded-full font-semibold transition-all border-2 ${
                  selectedCategory === category.id
                    ? 'bg-lime text-ink border-lime shadow-md'
                    : 'bg-white text-ink/70 border-ink/10 hover:border-lime/50 hover:bg-lime/5'
                }`}
              >
                {category.name} <span className="text-ink/50">({category.productCount})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-8 flex items-center gap-2 text-ink/60 font-medium">
          <span className="w-2 h-2 bg-lime rounded-full"></span>
          {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
        </div>

        {/* Products Grid */}
        {filteredProducts.length > 0 ? (
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
            initial="initial"
            animate="animate"
            variants={{
              animate: {
                transition: {
                  staggerChildren: 0.05,
                },
              },
            }}
          >
            {filteredProducts.map((product) => (
              <motion.div key={product.id} variants={fadeInUp}>
                <Link href={`/product/${product.id}`}>
                  <div className="group cursor-pointer h-full bg-white rounded-2xl border-2 border-ink/10 overflow-hidden hover:border-lime hover:shadow-2xl transition-all duration-300">
                    {/* Product Image */}
                    <div className="aspect-[4/3] bg-gradient-to-br from-cream to-white relative overflow-hidden">
                      {product.featured && (
                        <div className="absolute top-4 right-4 bg-lime text-ink px-4 py-2 text-xs font-bold rounded-full z-10 shadow-md">
                          FEATURED
                        </div>
                      )}

                      {/* Technical grid background */}
                      <div className="absolute inset-0 opacity-[0.03]">
                        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                          <defs>
                            <pattern id={`grid-${product.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
                              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#101010" strokeWidth="0.5"/>
                            </pattern>
                          </defs>
                          <rect width="100%" height="100%" fill={`url(#grid-${product.id})`} />
                        </svg>
                      </div>

                      {/* Product image or fallback illustration */}
                      {product.images && product.images.length > 0 ? (
                        <div className="absolute inset-0">
                          <Image
                            src={`https://fuqjvxcyonuztfsepecb.supabase.co/storage/v1/object/public/product-images/${product.images[0]}`}
                            alt={product.name}
                            fill
                            className="object-contain p-8"
                            onError={(e) => {
                              // If image fails to load, hide it and show fallback
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : null}
                      {/* Fallback illustration - shown if no image or image fails */}
                      {(!product.images || product.images.length === 0) && (
                        <div className="absolute inset-0 flex items-center justify-center p-8">
                          <ProductIllustration category={product.category} />
                        </div>
                      )}

                      {!product.in_stock && (
                        <div className="absolute inset-0 bg-ink/90 flex items-center justify-center backdrop-blur-sm">
                          <span className="text-cream font-bold text-lg">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-6">
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs font-bold uppercase tracking-wider text-lime">
                            {product.category}
                          </span>
                          {product.in_stock && (
                            <span className="flex items-center gap-1 text-xs text-ink/50">
                              <span className="w-1.5 h-1.5 bg-lime rounded-full"></span>
                              In Stock
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-ink group-hover:text-lime transition-colors mb-2">
                          {product.name}
                        </h3>
                        <p className="text-sm text-ink/60 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      </div>

                      <div className="flex justify-between items-center pt-4 border-t border-ink/5">
                        <div>
                          <div className="text-2xl font-bold text-ink">
                            ₹{product.price}
                          </div>
                          {product.specifications?.Material && (
                            <p className="text-xs text-ink/50 mt-1">
                              {product.specifications.Material}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-ink group-hover:text-lime transition-colors font-semibold">
                          <span className="text-sm">View</span>
                          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="text-center py-20 bg-white rounded-2xl border-2 border-ink/10">
            <svg className="w-20 h-20 mx-auto mb-6 text-ink/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <h3 className="text-2xl font-bold text-ink mb-2">
              No products found
            </h3>
            <p className="text-ink/60 mb-6 max-w-md mx-auto">
              Try adjusting your search or filter options to find what you're looking for
            </p>
            <Button
              variant="accent"
              size="md"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="rounded-full font-bold"
            >
              Clear All Filters
            </Button>
          </div>
        )}
      </div>

      {/* CTA Banner */}
      <section className="bg-gradient-to-br from-lime/10 to-yellow/10 border-y-2 border-ink/10 py-20 mt-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold font-handwritten text-ink mb-4">
            Need something custom?
            <div className="relative inline-block ml-2">
              <span className="relative z-10">?</span>
              <div className="absolute bottom-0 left-0 w-full h-3 bg-yellow opacity-60 rotate-2"></div>
            </div>
          </h2>
          <p className="text-lg text-ink/70 mb-8 max-w-2xl mx-auto">
            Can't find what you're looking for? We design and print custom parts tailored to your exact specifications.
          </p>
          <Link href="/custom">
            <Button variant="accent" size="lg" className="rounded-full font-bold px-8">
              Request Custom Quote
              <svg className="ml-2 w-5 h-5 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

// Product category illustrations - technical SVG style
function ProductIllustration({ category }: { category: string }) {
  switch (category) {
    case 'robotics':
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full max-w-[180px]" fill="none">
          {/* Robot/mechanical part illustration */}
          <rect x="50" y="60" width="100" height="80" rx="8" fill="#B7FF2A" opacity="0.2" stroke="#B7FF2A" strokeWidth="3"/>
          <rect x="60" y="70" width="30" height="30" rx="4" fill="#101010" opacity="0.1"/>
          <rect x="110" y="70" width="30" height="30" rx="4" fill="#101010" opacity="0.1"/>
          <line x1="75" y1="115" x2="125" y2="115" stroke="#B7FF2A" strokeWidth="4" strokeLinecap="round"/>
          <circle cx="75" cy="85" r="8" fill="#B7FF2A"/>
          <circle cx="125" cy="85" r="8" fill="#B7FF2A"/>
          <text x="100" y="30" textAnchor="middle" fontSize="10" fill="#101010" opacity="0.3" fontFamily="monospace">ROBOTICS</text>
        </svg>
      );
    case 'electronics':
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full max-w-[180px]" fill="none">
          {/* Circuit board illustration */}
          <rect x="40" y="50" width="120" height="100" rx="6" fill="#101010" opacity="0.05" stroke="#B7FF2A" strokeWidth="3"/>
          <circle cx="70" cy="80" r="6" fill="#B7FF2A"/>
          <circle cx="130" cy="80" r="6" fill="#B7FF2A"/>
          <circle cx="70" cy="120" r="6" fill="#B7FF2A"/>
          <circle cx="130" cy="120" r="6" fill="#B7FF2A"/>
          <path d="M 70 80 L 130 80 M 70 120 L 130 120 M 70 80 L 70 120 M 130 80 L 130 120" stroke="#FFD400" strokeWidth="2" opacity="0.6"/>
          <rect x="90" y="90" width="20" height="20" fill="#101010" opacity="0.1" rx="2"/>
          <text x="100" y="35" textAnchor="middle" fontSize="10" fill="#101010" opacity="0.3" fontFamily="monospace">ELECTRONICS</text>
        </svg>
      );
    case 'organization':
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full max-w-[180px]" fill="none">
          {/* Organizer illustration */}
          <rect x="50" y="60" width="100" height="80" rx="8" fill="#FFD400" opacity="0.1" stroke="#B7FF2A" strokeWidth="3"/>
          <line x1="75" y1="60" x2="75" y2="140" stroke="#B7FF2A" strokeWidth="2" opacity="0.5"/>
          <line x1="100" y1="60" x2="100" y2="140" stroke="#B7FF2A" strokeWidth="2" opacity="0.5"/>
          <line x1="125" y1="60" x2="125" y2="140" stroke="#B7FF2A" strokeWidth="2" opacity="0.5"/>
          <circle cx="62" cy="100" r="4" fill="#B7FF2A"/>
          <circle cx="87" cy="100" r="4" fill="#FFD400"/>
          <circle cx="112" cy="100" r="4" fill="#B7FF2A"/>
          <text x="100" y="35" textAnchor="middle" fontSize="10" fill="#101010" opacity="0.3" fontFamily="monospace">ORGANIZATION</text>
        </svg>
      );
    case 'prototyping':
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full max-w-[180px]" fill="none">
          {/* Prototype sketch illustration */}
          <path d="M 60 80 L 100 60 L 140 80 L 140 120 L 100 140 L 60 120 Z" fill="#B7FF2A" opacity="0.1" stroke="#B7FF2A" strokeWidth="3" strokeDasharray="5,5"/>
          <circle cx="60" cy="80" r="4" fill="#B7FF2A"/>
          <circle cx="100" cy="60" r="4" fill="#B7FF2A"/>
          <circle cx="140" cy="80" r="4" fill="#B7FF2A"/>
          <text x="90" y="105" fontSize="8" fill="#101010" opacity="0.4" fontFamily="monospace">PROTO</text>
          <text x="100" y="35" textAnchor="middle" fontSize="10" fill="#101010" opacity="0.3" fontFamily="monospace">PROTOTYPING</text>
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 200 200" className="w-full h-full max-w-[180px]" fill="none">
          {/* Generic 3D cube */}
          <path d="M 100 60 L 140 80 L 140 120 L 100 140 L 60 120 L 60 80 Z" fill="#B7FF2A" opacity="0.2" stroke="#B7FF2A" strokeWidth="3"/>
          <path d="M 100 60 L 100 100 M 60 80 L 100 100 M 140 80 L 100 100" stroke="#101010" opacity="0.2" strokeWidth="2"/>
          <text x="100" y="35" textAnchor="middle" fontSize="10" fill="#101010" opacity="0.3" fontFamily="monospace">3D PRINT</text>
        </svg>
      );
  }
}
