'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function CartPage() {
  // TODO: Implement cart state management with Context/Zustand
  const cartItems: any[] = [];

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <section className="bg-ink text-cream pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-4">
              Shopping Cart
            </h1>
            <p className="text-xl text-cream/80">
              Review your items before checkout
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {cartItems.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-6">
              {/* Cart items will be mapped here */}
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white border-2 border-ink/10 p-6 sticky top-24">
                <h2 className="text-2xl font-bold text-ink mb-6">
                  Order Summary
                </h2>
                {/* Summary details */}
              </div>
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center py-20"
          >
            <div className="text-8xl mb-6">🛒</div>
            <h2 className="text-3xl font-bold text-ink mb-4">
              Your cart is empty
            </h2>
            <p className="text-xl text-ink/60 mb-8">
              Start exploring our products and add items to your cart
            </p>
            <Link href="/explore">
              <Button variant="accent" size="lg">
                Browse Products
              </Button>
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  );
}
