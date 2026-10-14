'use client';

import { useState, use, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { calculatePrice, validateConfiguration, formatPriceBreakdown } from '@/lib/pricing';
import type { Product, ProductConfiguration, PriceBreakdown, ConfigurablePricingConfig } from '@/types/pricing';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ProductPage({ params }: PageProps) {
  const { id } = use(params);

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Configuration state
  const [configuration, setConfiguration] = useState<ProductConfiguration>({
    quantity: 1,
  });

  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [configErrors, setConfigErrors] = useState<string[]>([]);

  useEffect(() => {
    const supabase = createClient();
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
        const prod = data as unknown as Product;
        setProduct(prod);

        // Initialize configuration with defaults
        const initialConfig: ProductConfiguration = {
          quantity: prod.min_quantity || 1,
        };

        // Set default selections for configurable products
        if (prod.pricing_method === 'configurable') {
          const pricing = prod.pricing_config as ConfigurablePricingConfig;
          if (pricing.sizes && pricing.sizes.length > 0) {
            initialConfig.sizeIndex = 0;
          }
          if (pricing.materials && pricing.materials.length > 0) {
            initialConfig.materialIndex = 0;
          }
          if (pricing.colors && pricing.colors.length > 0) {
            initialConfig.colorIndex = 0;
          }
        }

        setConfiguration(initialConfig);
      }
      setLoading(false);
    }

    fetchProduct();
  }, [id]);

  // Recalculate price when configuration changes
  useEffect(() => {
    if (!product) return;

    if (product.pricing_method === 'quote') {
      setPriceBreakdown(null);
      setConfigErrors([]);
      return;
    }

    const validation = validateConfiguration(product, configuration);
    setConfigErrors(validation.errors);

    if (validation.valid) {
      const breakdown = calculatePrice(product, configuration);
      setPriceBreakdown(breakdown);
    } else {
      setPriceBreakdown(null);
    }
  }, [product, configuration]);

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

  const productImages = product.images && product.images.length > 0 ? product.images : [];

  const handleOrderNow = async () => {
    // Validate configuration
    const validation = validateConfiguration(product, configuration);
    if (!validation.valid) {
      alert('Please complete your product configuration:\n' + validation.errors.join('\n'));
      return;
    }

    // Calculate final price on server
    try {
      const response = await fetch('/api/calculate-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          configuration,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert('Error calculating price: ' + (errorData.error || 'Unknown error'));
        return;
      }

      const { priceBreakdown: serverBreakdown } = await response.json();

      // Build WhatsApp message
      let message = `Hi! I'd like to order:\n\n${product.name}\n`;

      if (serverBreakdown.details.size) {
        message += `Size: ${serverBreakdown.details.size}\n`;
      }
      if (serverBreakdown.details.material) {
        message += `Material: ${serverBreakdown.details.material}\n`;
      }
      if (serverBreakdown.details.color) {
        message += `Color: ${serverBreakdown.details.color}\n`;
      }

      message += `Quantity: ${configuration.quantity}\n`;
      message += `Unit Price: ₹${serverBreakdown.unitPrice.toFixed(2)}\n`;
      message += `Total: ₹${serverBreakdown.total.toFixed(2)}\n\n`;
      message += `Product URL: ${window.location.href}\n\n`;
      message += 'Please confirm availability and delivery details.';

      window.open(`https://wa.me/YOUR_PHONE?text=${encodeURIComponent(message)}`, '_blank');
    } catch (error) {
      console.error('Order error:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleRequestQuote = () => {
    // Redirect to custom quote page with product pre-filled
    const message = `I'd like a quote for:\n\n${product.name}\n\nProduct URL: ${window.location.href}`;
    window.open(`https://wa.me/YOUR_PHONE?text=${encodeURIComponent(message)}`, '_blank');
  };

  const updateQuantity = (newQuantity: number) => {
    setConfiguration({
      ...configuration,
      quantity: Math.max(product.min_quantity, Math.min(product.max_quantity, newQuantity)),
    });
  };

  return (
    <div className="min-h-screen bg-cream">
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-12">
        {/* Breadcrumb */}
        <nav className="mb-8 text-sm text-ink/60">
          <Link href="/" className="hover:text-ink">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/explore" className="hover:text-ink">Explore</Link>
          <span className="mx-2">/</span>
          <span className="text-ink">{product.name}</span>
        </nav>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left: Product Photo Gallery */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            {/* Main Image */}
            <div className="aspect-square bg-white border-2 border-ink/10 rounded-xl overflow-hidden relative mb-4">
              {productImages.length > 0 ? (
                <Image
                  src={`https://fuqjvxcyonuztfsepecb.supabase.co/storage/v1/object/public/product-images/${productImages[selectedImageIndex]}`}
                  alt={product.name}
                  fill
                  className="object-contain p-8"
                  priority
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-ink/40">
                    <svg className="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-sm">No image available</p>
                  </div>
                </div>
              )}

              {product.featured && (
                <div className="absolute top-4 right-4 bg-lime text-ink px-4 py-2 text-xs font-bold rounded-full shadow-md">
                  FEATURED
                </div>
              )}
            </div>

            {/* Thumbnail Gallery */}
            {productImages.length > 1 && (
              <div className="grid grid-cols-4 gap-3">
                {productImages.map((image: string, index: number) => (
                  <button
                    key={index}
                    onClick={() => setSelectedImageIndex(index)}
                    className={`aspect-square bg-white border-2 rounded-lg overflow-hidden transition-all ${
                      selectedImageIndex === index
                        ? 'border-lime ring-2 ring-lime/20'
                        : 'border-ink/10 hover:border-lime/50'
                    }`}
                  >
                    <Image
                      src={`https://fuqjvxcyonuztfsepecb.supabase.co/storage/v1/object/public/product-images/${image}`}
                      alt={`${product.name} - View ${index + 1}`}
                      width={200}
                      height={200}
                      className="object-cover w-full h-full"
                    />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* Right: Product Details & Configuration */}
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

              {/* Dynamic Price Display */}
              {product.pricing_method === 'fixed' && priceBreakdown && (
                <div className="flex items-baseline gap-4">
                  <span className="text-4xl font-bold text-ink">
                    ₹{priceBreakdown.unitPrice.toFixed(0)}
                  </span>
                  {!product.in_stock && (
                    <span className="text-red-600 font-semibold">Out of Stock</span>
                  )}
                </div>
              )}

              {product.pricing_method === 'configurable' && (
                <div className="bg-lime/5 border-2 border-lime/20 rounded-xl p-4">
                  {priceBreakdown ? (
                    <>
                      <div className="text-sm text-ink/60 mb-1">Estimated Price</div>
                      <div className="text-3xl font-bold text-ink">
                        ₹{priceBreakdown.unitPrice.toFixed(2)} <span className="text-lg text-ink/60">/ unit</span>
                      </div>
                      <div className="text-xl font-semibold text-ink mt-2">
                        Total: ₹{priceBreakdown.total.toFixed(2)}
                      </div>
                    </>
                  ) : (
                    <div className="text-lg text-ink/60">
                      Configure options to see price
                    </div>
                  )}
                </div>
              )}

              {product.pricing_method === 'quote' && (
                <div className="bg-yellow/10 border-2 border-yellow/30 rounded-xl p-4">
                  <div className="text-lg font-semibold text-ink">
                    💬 Custom Quote Required
                  </div>
                  <p className="text-sm text-ink/70 mt-1">
                    Price varies based on your requirements. Contact us for a detailed quote.
                  </p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="border-t border-ink/10 pt-6">
              <h3 className="font-semibold text-ink mb-3">Description</h3>
              <p className="text-lg text-ink/80 leading-relaxed">{product.description}</p>
              {product.long_description && (
                <p className="text-base text-ink/70 leading-relaxed mt-4">
                  {product.long_description}
                </p>
              )}
            </div>

            {/* Configurable Options */}
            {product.pricing_method === 'configurable' && (
              <ConfigurationWidget
                product={product}
                configuration={configuration}
                onConfigChange={setConfiguration}
                errors={configErrors}
              />
            )}

            {/* Production Time */}
            {product.production_time_days && (
              <div className="bg-ink/5 rounded-lg p-4">
                <div className="flex items-center gap-2 text-ink">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium">
                    Production time: {product.production_time_days} {product.production_time_days === 1 ? 'day' : 'days'}
                  </span>
                </div>
              </div>
            )}

            {/* Quantity */}
            {product.pricing_method !== 'quote' && (
              <div className="border-t border-ink/10 pt-6">
                <h3 className="font-semibold text-ink mb-3">
                  Quantity
                  <span className="text-sm text-ink/60 font-normal ml-2">
                    (Min: {product.min_quantity}, Max: {product.max_quantity})
                  </span>
                </h3>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => updateQuantity(configuration.quantity - 1)}
                    className="w-10 h-10 border-2 border-ink/20 hover:border-ink flex items-center justify-center transition-all rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={configuration.quantity <= product.min_quantity}
                  >
                    −
                  </button>
                  <span className="text-xl font-semibold text-ink w-12 text-center">
                    {configuration.quantity}
                  </span>
                  <button
                    onClick={() => updateQuantity(configuration.quantity + 1)}
                    className="w-10 h-10 border-2 border-ink/20 hover:border-ink flex items-center justify-center transition-all rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={configuration.quantity >= product.max_quantity}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="border-t border-ink/10 pt-6 space-y-3">
              {product.pricing_method === 'quote' ? (
                <Button
                  variant="accent"
                  size="lg"
                  className="w-full text-lg font-bold"
                  onClick={handleRequestQuote}
                >
                  💬 Request a Quote via WhatsApp
                </Button>
              ) : (
                <Button
                  variant="accent"
                  size="lg"
                  className="w-full text-lg font-bold"
                  onClick={handleOrderNow}
                  disabled={!product.in_stock || configErrors.length > 0}
                >
                  {!product.in_stock
                    ? 'Out of Stock'
                    : configErrors.length > 0
                    ? 'Complete Configuration'
                    : '💬 Order Now via WhatsApp'}
                </Button>
              )}

              {configErrors.length > 0 && (
                <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 font-medium">
                    {configErrors.join(', ')}
                  </p>
                </div>
              )}

              <p className="text-sm text-ink/60 text-center">
                Fast response • Secure ordering • Custom options available
              </p>
            </div>

            {/* Product Benefits */}
            <div className="bg-lime/10 border-2 border-lime/20 rounded-xl p-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <span className="text-ink font-medium">High-quality 3D printing</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <span className="text-ink font-medium">Fast delivery across India</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl">✓</span>
                <span className="text-ink font-medium">Custom options available</span>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Specifications */}
        {product.specifications && Object.keys(product.specifications).length > 0 && (
          <div className="mt-12 bg-white rounded-xl border-2 border-ink/10 p-8">
            <h3 className="text-2xl font-bold text-ink mb-6">Specifications</h3>
            <dl className="grid grid-cols-2 md:grid-cols-4 gap-6">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-sm text-ink/60 mb-1">{key}</dt>
                  <dd className="font-semibold text-ink">{value as string}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {/* Tags */}
        {product.tags && product.tags.length > 0 && (
          <div className="mt-8 pt-8 border-t border-ink/10">
            <div className="flex flex-wrap gap-2">
              {product.tags.map((tag: string) => (
                <span key={tag} className="px-3 py-1 bg-ink/5 text-ink/70 text-sm rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Configuration Widget Component
function ConfigurationWidget({
  product,
  configuration,
  onConfigChange,
  errors,
}: {
  product: Product;
  configuration: ProductConfiguration;
  onConfigChange: (config: ProductConfiguration) => void;
  errors: string[];
}) {
  const pricing = product.pricing_config as ConfigurablePricingConfig;

  return (
    <div className="border-t border-ink/10 pt-6 space-y-6">
      <h3 className="font-semibold text-ink text-lg">Configure Your Product</h3>

      {/* Size Selection */}
      {pricing.sizes && pricing.sizes.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-ink mb-3">
            Size <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-1 gap-3">
            {pricing.sizes.map((size, index) => (
              <button
                key={index}
                onClick={() => onConfigChange({ ...configuration, sizeIndex: index })}
                className={`p-4 border-2 rounded-lg text-left transition-all ${
                  configuration.sizeIndex === index
                    ? 'border-lime bg-lime/10 ring-2 ring-lime/20'
                    : 'border-ink/20 hover:border-lime/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-ink">{size.name}</div>
                    <div className="text-sm text-ink/60">{size.dimensions}</div>
                  </div>
                  <div className="text-lg font-bold text-ink">
                    ₹{size.price.toFixed(0)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Material Selection */}
      {pricing.materials && pricing.materials.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-ink mb-3">
            Material <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {pricing.materials.map((material, index) => (
              <button
                key={index}
                onClick={() => onConfigChange({ ...configuration, materialIndex: index })}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  configuration.materialIndex === index
                    ? 'border-lime bg-lime/10 ring-2 ring-lime/20'
                    : 'border-ink/20 hover:border-lime/50'
                }`}
              >
                <div className="font-semibold text-ink">{material.name}</div>
                {material.priceAdjustment !== 0 && (
                  <div className="text-sm text-ink/60 mt-1">
                    +₹{material.priceAdjustment}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Color Selection */}
      {pricing.colors && pricing.colors.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-ink mb-3">
            Color <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {pricing.colors.map((color, index) => (
              <button
                key={index}
                onClick={() => onConfigChange({ ...configuration, colorIndex: index })}
                className={`p-4 border-2 rounded-lg text-center transition-all ${
                  configuration.colorIndex === index
                    ? 'border-lime bg-lime/10 ring-2 ring-lime/20'
                    : 'border-ink/20 hover:border-lime/50'
                }`}
              >
                <div className="font-semibold text-ink">{color.name}</div>
                {color.additionalCharge !== 0 && (
                  <div className="text-sm text-ink/60 mt-1">
                    +₹{color.additionalCharge}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
