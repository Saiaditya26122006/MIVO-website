'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

interface MosaicItem {
  id: string;
  type: 'product' | 'accent';
  imagePath?: string;
  productName?: string;
  color?: string;
  size: 'small' | 'medium' | 'large';
}

export function ProductMosaic() {
  const [items, setItems] = useState<MosaicItem[]>([]);

  useEffect(() => {
    async function fetchProductImages() {
      const supabase = createClient();
      const { data: products } = await supabase
        .from('products')
        .select('id, name, images')
        .eq('published', true)
        .limit(12);

      if (products && products.length > 0) {
        // Create mosaic items from products
        const productItems: MosaicItem[] = products
          .filter(p => p.images && p.images.length > 0)
          .map((p, idx) => ({
            id: p.id,
            type: 'product' as const,
            imagePath: p.images[0],
            productName: p.name,
            size: idx % 3 === 0 ? 'large' : idx % 3 === 1 ? 'medium' : 'small',
          }));

        // Add accent tiles occasionally for composition
        const accentTiles: MosaicItem[] = [
          { id: 'accent-1', type: 'accent', color: 'lime', size: 'small' },
          { id: 'accent-2', type: 'accent', color: 'yellow', size: 'small' },
        ];

        // Interleave products and accents
        const allItems = [...productItems.slice(0, 10), ...accentTiles];
        setItems(allItems);
      } else {
        // Fallback: use existing public images
        const fallbackItems: MosaicItem[] = [
          { id: 'fb-1', type: 'product', imagePath: '/services/custom-parts.webp', size: 'large' },
          { id: 'fb-2', type: 'product', imagePath: '/services/3d-printing.webp', size: 'medium' },
          { id: 'fb-3', type: 'product', imagePath: '/services/cad-design.webp', size: 'small' },
          { id: 'fb-4', type: 'product', imagePath: '/services/prototyping.webp', size: 'medium' },
          { id: 'accent-1', type: 'accent', color: 'lime', size: 'small' },
          { id: 'fb-5', type: 'product', imagePath: '/bambu-a1-printing-gear.png', size: 'large' },
          { id: 'fb-6', type: 'product', imagePath: '/services/custom-parts.webp', size: 'small' },
          { id: 'accent-2', type: 'accent', color: 'yellow', size: 'small' },
          { id: 'fb-7', type: 'product', imagePath: '/services/idea-sketch.webp', size: 'medium' },
        ];
        setItems(fallbackItems);
      }
    }

    fetchProductImages();
  }, []);

  // Split items into 3 columns for vertical scrolling
  const column1Items = items.filter((_, idx) => idx % 3 === 0);
  const column2Items = items.filter((_, idx) => idx % 3 === 1);
  const column3Items = items.filter((_, idx) => idx % 3 === 2);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Three vertical columns with continuous scroll */}
      <div className="flex gap-3 h-full">
        {/* Column 1: Scrolls down */}
        <MosaicColumn items={column1Items} direction="down" speed="slow" />

        {/* Column 2: Scrolls up (opposite direction) */}
        <MosaicColumn items={column2Items} direction="up" speed="medium" />

        {/* Column 3: Scrolls down */}
        <MosaicColumn items={column3Items} direction="down" speed="fast" />
      </div>

      {/* Gradient fade at top and bottom for seamless effect */}
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-cream to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cream to-transparent pointer-events-none z-10" />
    </div>
  );
}

interface MosaicColumnProps {
  items: MosaicItem[];
  direction: 'up' | 'down';
  speed: 'slow' | 'medium' | 'fast';
}

function MosaicColumn({ items, direction, speed }: MosaicColumnProps) {
  if (items.length === 0) return null;

  // Duplicate items for seamless loop
  const duplicatedItems = [...items, ...items];

  const animationDuration = speed === 'slow' ? '40s' : speed === 'medium' ? '35s' : '30s';
  const animationName = direction === 'up' ? 'scrollUp' : 'scrollDown';

  return (
    <div className="flex-1 relative overflow-hidden">
      <div
        className="mosaic-column"
        style={{
          animation: `${animationName} ${animationDuration} linear infinite`,
        }}
      >
        {duplicatedItems.map((item, idx) => (
          <MosaicTile key={`${item.id}-${idx}`} item={item} />
        ))}
      </div>

      <style jsx>{`
        .mosaic-column {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        @keyframes scrollDown {
          0% {
            transform: translateY(0);
          }
          100% {
            transform: translateY(-50%);
          }
        }

        @keyframes scrollUp {
          0% {
            transform: translateY(-50%);
          }
          100% {
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .mosaic-column {
            animation: none !important;
          }
        }

        /* Entrance animation on load */
        @keyframes fadeInScale {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}

function MosaicTile({ item }: { item: MosaicItem }) {
  const sizeClasses = {
    small: 'h-32',
    medium: 'h-48',
    large: 'h-64',
  };

  if (item.type === 'accent') {
    const colorClasses = {
      lime: 'bg-lime',
      yellow: 'bg-yellow',
      orange: 'bg-orange',
    };

    return (
      <div
        className={`${sizeClasses[item.size]} ${colorClasses[item.color as keyof typeof colorClasses] || 'bg-lime'}
          rounded-2xl flex-shrink-0 opacity-20 animate-fadeInScale`}
        style={{
          animationDelay: `${Math.random() * 0.5}s`,
          animationDuration: '0.8s',
          animationFillMode: 'both',
        }}
      />
    );
  }

  // Product tile
  const isSupabaseImage = item.imagePath && !item.imagePath.startsWith('/');
  const imageSrc = isSupabaseImage
    ? `https://fuqjvxcyonuztfsepecb.supabase.co/storage/v1/object/public/product-images/${item.imagePath}`
    : item.imagePath || '/services/custom-parts.webp';

  return (
    <div
      className={`${sizeClasses[item.size]} bg-white rounded-2xl border-2 border-ink/10
        overflow-hidden flex-shrink-0 relative group hover:border-lime transition-colors
        duration-300 animate-fadeInScale shadow-sm`}
      style={{
        animationDelay: `${Math.random() * 0.5}s`,
        animationDuration: '0.8s',
        animationFillMode: 'both',
      }}
    >
      <Image
        src={imageSrc}
        alt={item.productName || 'MIVO Product'}
        fill
        sizes="(max-width: 768px) 25vw, 15vw"
        className="object-cover p-4"
        loading="lazy"
      />

      {/* Subtle overlay on hover */}
      <div className="absolute inset-0 bg-lime/0 group-hover:bg-lime/5 transition-colors duration-300" />
    </div>
  );
}

// Mobile-optimized version with fewer columns
export function ProductMosaicMobile() {
  const [items, setItems] = useState<MosaicItem[]>([]);

  useEffect(() => {
    async function fetchProductImages() {
      const supabase = createClient();
      const { data: products } = await supabase
        .from('products')
        .select('id, name, images')
        .eq('published', true)
        .limit(6);

      if (products && products.length > 0) {
        const productItems: MosaicItem[] = products
          .filter(p => p.images && p.images.length > 0)
          .map((p, idx) => ({
            id: p.id,
            type: 'product' as const,
            imagePath: p.images[0],
            productName: p.name,
            size: idx % 2 === 0 ? 'medium' : 'small',
          }));

        setItems(productItems.slice(0, 6));
      } else {
        // Fallback images for mobile
        const fallbackItems: MosaicItem[] = [
          { id: 'fb-1', type: 'product', imagePath: '/services/custom-parts.webp', size: 'medium' },
          { id: 'fb-2', type: 'product', imagePath: '/services/3d-printing.webp', size: 'small' },
          { id: 'fb-3', type: 'product', imagePath: '/services/cad-design.webp', size: 'medium' },
          { id: 'fb-4', type: 'product', imagePath: '/bambu-a1-printing-gear.png', size: 'small' },
        ];
        setItems(fallbackItems);
      }
    }

    fetchProductImages();
  }, []);

  // Only 2 columns for mobile
  const column1Items = items.filter((_, idx) => idx % 2 === 0);
  const column2Items = items.filter((_, idx) => idx % 2 === 1);

  return (
    <div className="relative w-full h-[300px] overflow-hidden">
      <div className="flex gap-2 h-full">
        <MosaicColumn items={column1Items} direction="down" speed="medium" />
        <MosaicColumn items={column2Items} direction="up" speed="slow" />
      </div>

      {/* Gradient fade */}
      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-cream to-transparent pointer-events-none z-10" />
      <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-cream to-transparent pointer-events-none z-10" />
    </div>
  );
}
