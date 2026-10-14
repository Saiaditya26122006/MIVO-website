'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import Image from 'next/image';
import type {
  PricingMethod,
  SizeOption,
  MaterialOption,
  ColorOption,
  FixedPricingConfig,
  ConfigurablePricingConfig,
  QuotePricingConfig,
} from '@/types/pricing';

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('robotics');
  const [material, setMaterial] = useState('PLA');
  const [dimensions, setDimensions] = useState('');
  const [weight, setWeight] = useState('');
  const [color, setColor] = useState('');
  const [inStock, setInStock] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [tags, setTags] = useState('');

  // Pricing state
  const [pricingMethod, setPricingMethod] = useState<PricingMethod>('fixed');
  const [basePrice, setBasePrice] = useState('');
  const [productionTimeDays, setProductionTimeDays] = useState('');
  const [minQuantity, setMinQuantity] = useState('1');
  const [maxQuantity, setMaxQuantity] = useState('100');

  // Configurable pricing options
  const [sizeOptions, setSizeOptions] = useState<SizeOption[]>([]);
  const [materialOptions, setMaterialOptions] = useState<MaterialOption[]>([]);
  const [colorOptions, setColorOptions] = useState<ColorOption[]>([]);

  // Quote-based config
  const [requiredInfo, setRequiredInfo] = useState<string[]>(['dimensions', 'quantity']);
  const [referencePhotosRequired, setReferencePhotosRequired] = useState(false);

  // Image state - support multiple images
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [newProductImages, setNewProductImages] = useState<File[]>([]);
  const [newImagePreviewUrls, setNewImagePreviewUrls] = useState<string[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  // Load user and product data
  useEffect(() => {
    const supabase = createClient();

    async function loadData() {
      // Check auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/admin/login');
        return;
      }
      setUser(user);

      // Fetch product
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        setError('Product not found');
        setLoading(false);
        return;
      }

      // Populate form fields
      setName(product.name || '');
      setDescription(product.description || '');
      setLongDescription(product.long_description || '');
      setPrice(product.price?.toString() || '');
      setCategory(product.category || 'robotics');
      setInStock(product.in_stock ?? true);
      setFeatured(product.featured ?? false);
      setTags(product.tags?.join(', ') || '');
      setExistingImages(product.images || []);

      // Populate specifications
      if (product.specifications) {
        setMaterial(product.specifications.Material || 'PLA');
        setDimensions(product.specifications.Dimensions || '');
        setWeight(product.specifications.Weight || '');
        setColor(product.specifications.Color || '');
      }

      // Populate pricing fields
      setPricingMethod(product.pricing_method || 'fixed');
      setProductionTimeDays(product.production_time_days?.toString() || '');
      setMinQuantity(product.min_quantity?.toString() || '1');
      setMaxQuantity(product.max_quantity?.toString() || '100');

      // Populate pricing config
      if (product.pricing_config) {
        const config = product.pricing_config;

        if (product.pricing_method === 'fixed') {
          setBasePrice(config.basePrice?.toString() || '');
        } else if (product.pricing_method === 'configurable') {
          setBasePrice(config.basePrice?.toString() || '');
          setSizeOptions(config.sizes || []);
          setMaterialOptions(config.materials || []);
          setColorOptions(config.colors || []);
        } else if (product.pricing_method === 'quote') {
          setRequiredInfo(config.requiredInfo || ['dimensions', 'quantity']);
          setReferencePhotosRequired(config.referencePhotosRequired || false);
        }
      } else {
        // Legacy product without pricing config
        setBasePrice(product.price?.toString() || '');
      }

      setLoading(false);
    }

    loadData();
  }, [productId, router]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      newImagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [newImagePreviewUrls]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const validFiles: File[] = [];
    const newPreviewUrls: string[] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        setError(`${file.name} is not a valid image file`);
        continue;
      }

      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} exceeds 5MB limit`);
        continue;
      }

      validFiles.push(file);
      newPreviewUrls.push(URL.createObjectURL(file));
    }

    if (validFiles.length > 0) {
      setNewProductImages([...newProductImages, ...validFiles]);
      setNewImagePreviewUrls([...newImagePreviewUrls, ...newPreviewUrls]);
      setError('');
    }
  };

  const removeExistingImage = (imagePath: string) => {
    setExistingImages(existingImages.filter(img => img !== imagePath));
    setImagesToDelete([...imagesToDelete, imagePath]);
  };

  const removeNewImage = (index: number) => {
    URL.revokeObjectURL(newImagePreviewUrls[index]);
    setNewProductImages(newProductImages.filter((_, i) => i !== index));
    setNewImagePreviewUrls(newImagePreviewUrls.filter((_, i) => i !== index));
  };

  // Size option management
  const addSizeOption = () => {
    setSizeOptions([...sizeOptions, { name: '', dimensions: '', price: 0 }]);
  };

  const updateSizeOption = (index: number, field: keyof SizeOption, value: string | number) => {
    const updated = [...sizeOptions];
    updated[index] = { ...updated[index], [field]: value };
    setSizeOptions(updated);
  };

  const removeSizeOption = (index: number) => {
    setSizeOptions(sizeOptions.filter((_, i) => i !== index));
  };

  const moveSizeOption = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= sizeOptions.length) return;
    const updated = [...sizeOptions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setSizeOptions(updated);
  };

  // Material option management
  const addMaterialOption = () => {
    setMaterialOptions([...materialOptions, { name: '', priceAdjustment: 0 }]);
  };

  const updateMaterialOption = (index: number, field: keyof MaterialOption, value: string | number) => {
    const updated = [...materialOptions];
    updated[index] = { ...updated[index], [field]: value };
    setMaterialOptions(updated);
  };

  const removeMaterialOption = (index: number) => {
    setMaterialOptions(materialOptions.filter((_, i) => i !== index));
  };

  const moveMaterialOption = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= materialOptions.length) return;
    const updated = [...materialOptions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setMaterialOptions(updated);
  };

  // Color option management
  const addColorOption = () => {
    setColorOptions([...colorOptions, { name: '', additionalCharge: 0 }]);
  };

  const updateColorOption = (index: number, field: keyof ColorOption, value: string | number) => {
    const updated = [...colorOptions];
    updated[index] = { ...updated[index], [field]: value };
    setColorOptions(updated);
  };

  const removeColorOption = (index: number) => {
    setColorOptions(colorOptions.filter((_, i) => i !== index));
  };

  const moveColorOption = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= colorOptions.length) return;
    const updated = [...colorOptions];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setColorOptions(updated);
  };

  const toggleRequiredInfo = (info: string) => {
    if (requiredInfo.includes(info)) {
      setRequiredInfo(requiredInfo.filter((i) => i !== info));
    } else {
      setRequiredInfo([...requiredInfo, info]);
    }
  };

  const handleSaveDraft = async () => {
    await handleSubmit(false);
  };

  const handlePublish = async () => {
    await handleSubmit(true);
  };

  const handleSubmit = async (publish: boolean) => {
    // Prevent multiple submissions
    if (saving) {
      console.log('⚠️ Already saving, ignoring duplicate submission');
      return;
    }

    console.log('=== STARTING PRODUCT UPDATE ===');
    console.log('Product ID:', productId);
    console.log('Publishing:', publish);

    // Validation
    if (!name.trim()) {
      setError('Product name is required');
      return;
    }

    if (!description.trim()) {
      setError('Description is required');
      return;
    }

    // Validate pricing based on method
    if (pricingMethod === 'fixed') {
      if (!basePrice || parseFloat(basePrice) <= 0) {
        setError('Valid base price is required for fixed pricing');
        return;
      }
    } else if (pricingMethod === 'configurable') {
      if (!basePrice || parseFloat(basePrice) <= 0) {
        setError('Valid base price is required for configurable pricing');
        return;
      }
      if (sizeOptions.length === 0 && materialOptions.length === 0 && colorOptions.length === 0) {
        setError('At least one configuration option (size, material, or color) is required for configurable pricing');
        return;
      }
      for (const size of sizeOptions) {
        if (!size.name.trim() || !size.dimensions.trim() || size.price <= 0) {
          setError('All size options must have a name, dimensions, and valid price');
          return;
        }
      }
      for (const mat of materialOptions) {
        if (!mat.name.trim()) {
          setError('All material options must have a name');
          return;
        }
      }
      for (const col of colorOptions) {
        if (!col.name.trim()) {
          setError('All color options must have a name');
          return;
        }
      }
    }

    if (existingImages.length === 0 && newProductImages.length === 0) {
      setError('At least one product image is required');
      return;
    }

    console.log('✓ Validation passed');
    setSaving(true);
    setError('');

    try {
      const supabase = createClient();
      console.log('📤 Starting product update...');

      // Check auth first
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Auth session:', session ? 'Active' : 'MISSING');
      if (!session) {
        throw new Error('No active session - please log out and log back in');
      }
      console.log('User email:', session.user.email);

      // Delete removed images from storage
      for (const imagePath of imagesToDelete) {
        console.log('🗑️ Deleting image:', imagePath);
        await supabase.storage.from('product-images').remove([imagePath]);
      }

      // Upload new images to Supabase storage
      const uploadedImagePaths: string[] = [];

      for (let i = 0; i < newProductImages.length; i++) {
        const image = newProductImages[i];
        console.log(`🖼️ Uploading image ${i + 1}/${newProductImages.length}:`, image.name);

        const imageFileName = `${Date.now()}-${i}-${image.name}`;
        const { data: imageData, error: imageError } = await supabase.storage
          .from('product-images')
          .upload(imageFileName, image);

        if (imageError) throw imageError;
        uploadedImagePaths.push(imageData.path);
        console.log(`✓ Image ${i + 1} uploaded:`, imageData.path);
      }

      // Combine existing and new images
      const finalImages = [...existingImages, ...uploadedImagePaths];

      // Build specifications object
      const specifications: any = {};
      if (material) specifications.Material = material;
      if (dimensions) specifications.Dimensions = dimensions;
      if (weight) specifications.Weight = weight;
      if (color) specifications.Color = color;

      // Build pricing config based on method
      let pricingConfig: FixedPricingConfig | ConfigurablePricingConfig | QuotePricingConfig;
      let legacyPrice = 0;

      if (pricingMethod === 'fixed') {
        pricingConfig = {
          basePrice: parseFloat(basePrice),
        };
        legacyPrice = parseFloat(basePrice);
      } else if (pricingMethod === 'configurable') {
        pricingConfig = {
          basePrice: parseFloat(basePrice),
          sizes: sizeOptions.length > 0 ? sizeOptions : undefined,
          materials: materialOptions.length > 0 ? materialOptions : undefined,
          colors: colorOptions.length > 0 ? colorOptions : undefined,
        };
        legacyPrice = sizeOptions.length > 0 ? sizeOptions[0].price : parseFloat(basePrice);
      } else {
        pricingConfig = {
          requiredInfo,
          referencePhotosRequired,
        };
        legacyPrice = 0;
      }

      // Update product in database
      console.log('💾 Updating product record...');
      console.log('Data being sent:', {
        name: name.trim(),
        description: description.trim(),
        pricing_method: pricingMethod,
        published: publish,
      });

      // Build update object - only include pricing fields if they might exist in DB
      const updateData: any = {
        name: name.trim(),
        description: description.trim(),
        long_description: longDescription.trim() || null,
        price: legacyPrice,
        category,
        images: finalImages,
        in_stock: inStock,
        featured,
        published: publish,
        specifications,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t),
      };

      // Try to include pricing fields - if they don't exist, the update will still work for other fields
      try {
        updateData.pricing_method = pricingMethod;
        updateData.pricing_config = pricingConfig;
        updateData.production_time_days = productionTimeDays ? parseInt(productionTimeDays) : null;
        updateData.min_quantity = parseInt(minQuantity);
        updateData.max_quantity = parseInt(maxQuantity);
      } catch (e) {
        console.warn('Pricing columns may not exist in database yet. Run supabase-pricing-migration.sql');
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', productId)
        .select()
        .single();

      console.log('📥 Database response:', { product, productError });

      if (productError) {
        console.error('❌ Database error:', productError);
        console.error('Error details:', JSON.stringify(productError, null, 2));

        // Special handling for missing column error
        if (productError.code === 'PGRST204' || productError.message?.includes('max_quantity') || productError.message?.includes('pricing_method')) {
          throw new Error(
            'Database migration required!\n\n' +
            'The pricing columns do not exist in your database.\n\n' +
            'Please run supabase-pricing-migration.sql in Supabase SQL Editor:\n' +
            '1. Go to Supabase Dashboard → SQL Editor\n' +
            '2. Copy contents of supabase-pricing-migration.sql\n' +
            '3. Click "Run"\n\n' +
            `Original error: ${productError.message}`
          );
        }

        throw new Error(`Database error: ${productError.message} (Code: ${productError.code})`);
      }

      if (!product) {
        console.error('❌ Update returned no data');
        throw new Error('Update succeeded but no product data returned');
      }

      console.log('✓ Product updated successfully!');
      console.log('Updated product data:', product);
      console.log('Redirecting to products list...');

      // Show success message
      alert('✅ Product updated successfully!\n\nChanges:\n- Name: ' + product.name + '\n- Published: ' + (product.published ? 'Yes' : 'No'));

      // Small delay to ensure user sees the alert
      await new Promise(resolve => setTimeout(resolve, 500));

      router.push('/admin/products');
    } catch (err: any) {
      console.error('❌ Error updating product:', err);
      setError(err.message || 'Failed to update product');

      // Show detailed error in console for debugging
      if (err.code) {
        console.error('Error code:', err.code);
      }
      if (err.details) {
        console.error('Error details:', err.details);
      }
      if (err.hint) {
        console.error('Error hint:', err.hint);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink/70">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error && !name) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-800 font-medium text-lg mb-4">{error}</p>
          <Button onClick={() => router.push('/admin/products')} variant="secondary">
            Back to Products
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12 relative">
      {/* Loading Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-ink/50 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-2xl border-2 border-lime max-w-sm mx-4">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-xl font-bold text-ink mb-2">Updating Product...</h3>
              <p className="text-ink/60">Please wait while we save your changes</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold font-handwritten text-ink mb-2">
          Edit Product
        </h1>
        <p className="text-lg text-ink/70">Update product details and images</p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <p className="text-red-800 font-medium">{error}</p>
        </div>
      )}

      <form className="space-y-8" onSubmit={(e) => e.preventDefault()}>
        {/* Basic Information */}
        <div className="bg-white rounded-2xl border-2 border-ink/10 p-8">
          <h2 className="text-2xl font-bold text-ink mb-6">Basic Information</h2>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-ink mb-2">
                Product Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                placeholder="e.g., Robot Gripper Arm"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-ink mb-2">
                Short Description *
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all resize-none"
                placeholder="Brief description for product cards (2-3 sentences)"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-ink mb-2">
                Long Description
              </label>
              <textarea
                value={longDescription}
                onChange={(e) => setLongDescription(e.target.value)}
                rows={6}
                className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all resize-none"
                placeholder="Detailed description for product page"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-ink mb-2">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                >
                  <option value="robotics">Robotics</option>
                  <option value="electronics">Electronics</option>
                  <option value="organization">Organization</option>
                  <option value="prototyping">Prototyping</option>
                  <option value="home">Home</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-ink mb-2">
                  Tags (comma separated)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                  placeholder="robotics, servo, gripper"
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={inStock}
                  onChange={(e) => setInStock(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-ink/20 text-lime focus:ring-lime"
                />
                <span className="text-sm font-semibold text-ink">In Stock</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="w-5 h-5 rounded border-2 border-ink/20 text-lime focus:ring-lime"
                />
                <span className="text-sm font-semibold text-ink">Featured Product</span>
              </label>
            </div>
          </div>
        </div>

        {/* Pricing Configuration */}
        <div className="bg-white rounded-2xl border-2 border-ink/10 p-8">
          <h2 className="text-2xl font-bold text-ink mb-6">Pricing Configuration</h2>

          {/* Pricing Method Selection */}
          <div className="mb-8">
            <label className="block text-sm font-bold text-ink mb-4">Pricing Method *</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className={`cursor-pointer p-6 rounded-xl border-2 transition-all ${
                pricingMethod === 'fixed' ? 'border-lime bg-lime/5' : 'border-ink/10 hover:border-lime/50'
              }`}>
                <input
                  type="radio"
                  name="pricingMethod"
                  value="fixed"
                  checked={pricingMethod === 'fixed'}
                  onChange={(e) => setPricingMethod(e.target.value as PricingMethod)}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-2xl mb-2">💰</div>
                  <div className="font-bold text-ink mb-1">Fixed Price</div>
                  <div className="text-xs text-ink/60">Single price for all customers</div>
                </div>
              </label>

              <label className={`cursor-pointer p-6 rounded-xl border-2 transition-all ${
                pricingMethod === 'configurable' ? 'border-lime bg-lime/5' : 'border-ink/10 hover:border-lime/50'
              }`}>
                <input
                  type="radio"
                  name="pricingMethod"
                  value="configurable"
                  checked={pricingMethod === 'configurable'}
                  onChange={(e) => setPricingMethod(e.target.value as PricingMethod)}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-2xl mb-2">⚙️</div>
                  <div className="font-bold text-ink mb-1">Configurable</div>
                  <div className="text-xs text-ink/60">Price varies by options</div>
                </div>
              </label>

              <label className={`cursor-pointer p-6 rounded-xl border-2 transition-all ${
                pricingMethod === 'quote' ? 'border-lime bg-lime/5' : 'border-ink/10 hover:border-lime/50'
              }`}>
                <input
                  type="radio"
                  name="pricingMethod"
                  value="quote"
                  checked={pricingMethod === 'quote'}
                  onChange={(e) => setPricingMethod(e.target.value as PricingMethod)}
                  className="sr-only"
                />
                <div className="text-center">
                  <div className="text-2xl mb-2">📋</div>
                  <div className="font-bold text-ink mb-1">Quote Required</div>
                  <div className="text-xs text-ink/60">Custom pricing per order</div>
                </div>
              </label>
            </div>
          </div>

          {/* Fixed Pricing */}
          {pricingMethod === 'fixed' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-ink mb-2">Base Price (₹) *</label>
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                  placeholder="199.00"
                />
              </div>
            </div>
          )}

          {/* Configurable Pricing */}
          {pricingMethod === 'configurable' && (
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-bold text-ink mb-2">Base Price (₹) *</label>
                <input
                  type="number"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  min="0"
                  step="0.01"
                  className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                  placeholder="199.00"
                />
                <p className="text-xs text-ink/60 mt-1">Base price (used if no size options)</p>
              </div>

              {/* Size Options */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-bold text-ink">Size Options</label>
                  <Button type="button" variant="secondary" size="sm" onClick={addSizeOption}>
                    + Add Size
                  </Button>
                </div>
                {sizeOptions.map((size, index) => (
                  <div key={index} className="mb-4 p-4 border-2 border-ink/10 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
                      <input
                        type="text"
                        value={size.name}
                        onChange={(e) => updateSizeOption(index, 'name', e.target.value)}
                        placeholder="Size name (e.g., Small)"
                        className="px-3 py-2 border-2 border-ink/20 rounded-lg focus:border-lime"
                      />
                      <input
                        type="text"
                        value={size.dimensions}
                        onChange={(e) => updateSizeOption(index, 'dimensions', e.target.value)}
                        placeholder="Dimensions"
                        className="px-3 py-2 border-2 border-ink/20 rounded-lg focus:border-lime"
                      />
                      <input
                        type="number"
                        value={size.price}
                        onChange={(e) => updateSizeOption(index, 'price', parseFloat(e.target.value) || 0)}
                        placeholder="Price (₹)"
                        min="0"
                        step="0.01"
                        className="px-3 py-2 border-2 border-ink/20 rounded-lg focus:border-lime"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveSizeOption(index, 'up')}
                        disabled={index === 0}
                        className="text-ink/50 hover:text-ink disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSizeOption(index, 'down')}
                        disabled={index === sizeOptions.length - 1}
                        className="text-ink/50 hover:text-ink disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSizeOption(index)}
                        className="ml-auto text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Material Options */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-bold text-ink">Material Options</label>
                  <Button type="button" variant="secondary" size="sm" onClick={addMaterialOption}>
                    + Add Material
                  </Button>
                </div>
                {materialOptions.map((mat, index) => (
                  <div key={index} className="mb-4 p-4 border-2 border-ink/10 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                      <input
                        type="text"
                        value={mat.name}
                        onChange={(e) => updateMaterialOption(index, 'name', e.target.value)}
                        placeholder="Material name (e.g., PLA, ABS)"
                        className="px-3 py-2 border-2 border-ink/20 rounded-lg focus:border-lime"
                      />
                      <input
                        type="number"
                        value={mat.priceAdjustment}
                        onChange={(e) => updateMaterialOption(index, 'priceAdjustment', parseFloat(e.target.value) || 0)}
                        placeholder="Price adjustment (₹)"
                        step="0.01"
                        className="px-3 py-2 border-2 border-ink/20 rounded-lg focus:border-lime"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveMaterialOption(index, 'up')}
                        disabled={index === 0}
                        className="text-ink/50 hover:text-ink disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveMaterialOption(index, 'down')}
                        disabled={index === materialOptions.length - 1}
                        className="text-ink/50 hover:text-ink disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMaterialOption(index)}
                        className="ml-auto text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Color Options */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="text-sm font-bold text-ink">Color Options</label>
                  <Button type="button" variant="secondary" size="sm" onClick={addColorOption}>
                    + Add Color
                  </Button>
                </div>
                {colorOptions.map((col, index) => (
                  <div key={index} className="mb-4 p-4 border-2 border-ink/10 rounded-xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-2">
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => updateColorOption(index, 'name', e.target.value)}
                        placeholder="Color name"
                        className="px-3 py-2 border-2 border-ink/20 rounded-lg focus:border-lime"
                      />
                      <input
                        type="number"
                        value={col.additionalCharge}
                        onChange={(e) => updateColorOption(index, 'additionalCharge', parseFloat(e.target.value) || 0)}
                        placeholder="Additional charge (₹)"
                        min="0"
                        step="0.01"
                        className="px-3 py-2 border-2 border-ink/20 rounded-lg focus:border-lime"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => moveColorOption(index, 'up')}
                        disabled={index === 0}
                        className="text-ink/50 hover:text-ink disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveColorOption(index, 'down')}
                        disabled={index === colorOptions.length - 1}
                        className="text-ink/50 hover:text-ink disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => removeColorOption(index)}
                        className="ml-auto text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quote-based Configuration */}
          {pricingMethod === 'quote' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-ink mb-4">Required Information</label>
                <div className="space-y-2">
                  {['dimensions', 'quantity', 'material', 'color', 'usage'].map((info) => (
                    <label key={info} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requiredInfo.includes(info)}
                        onChange={() => toggleRequiredInfo(info)}
                        className="w-4 h-4 rounded border-2 border-ink/20 text-lime focus:ring-lime"
                      />
                      <span className="text-sm text-ink capitalize">{info}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={referencePhotosRequired}
                    onChange={(e) => setReferencePhotosRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-2 border-ink/20 text-lime focus:ring-lime"
                  />
                  <span className="text-sm font-semibold text-ink">Require reference photos</span>
                </label>
              </div>
            </div>
          )}

          {/* Common Pricing Fields */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Production Time (days)</label>
              <input
                type="number"
                value={productionTimeDays}
                onChange={(e) => setProductionTimeDays(e.target.value)}
                min="1"
                className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                placeholder="7"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Min Quantity</label>
              <input
                type="number"
                value={minQuantity}
                onChange={(e) => setMinQuantity(e.target.value)}
                min="1"
                className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Max Quantity</label>
              <input
                type="number"
                value={maxQuantity}
                onChange={(e) => setMaxQuantity(e.target.value)}
                min="1"
                className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Specifications */}
        <div className="bg-white rounded-2xl border-2 border-ink/10 p-8">
          <h2 className="text-2xl font-bold text-ink mb-6">Specifications</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Default Material</label>
              <input
                type="text"
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                placeholder="PLA"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Default Color</label>
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                placeholder="Black"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Dimensions</label>
              <input
                type="text"
                value={dimensions}
                onChange={(e) => setDimensions(e.target.value)}
                className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                placeholder="10cm x 5cm x 2cm"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-ink mb-2">Weight</label>
              <input
                type="text"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full px-4 py-3 border-2 border-ink/20 rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                placeholder="50g"
              />
            </div>
          </div>
        </div>

        {/* Product Images */}
        <div className="bg-white rounded-2xl border-2 border-ink/10 p-8">
          <h2 className="text-2xl font-bold text-ink mb-6">Product Images *</h2>

          {/* Existing Images */}
          {existingImages.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-ink mb-4">Current Images</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {existingImages.map((imagePath, index) => (
                  <div key={imagePath} className="relative group">
                    <div className="aspect-square rounded-xl overflow-hidden border-2 border-ink/10">
                      <Image
                        src={`https://fuqjvxcyonuztfsepecb.supabase.co/storage/v1/object/public/product-images/${imagePath}`}
                        alt={`Product ${index + 1}`}
                        width={300}
                        height={300}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeExistingImage(imagePath)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                    {index === 0 && (
                      <div className="absolute bottom-2 left-2 bg-lime text-ink px-2 py-1 text-xs font-bold rounded">
                        Primary
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Images Preview */}
          {newImagePreviewUrls.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-bold text-ink mb-4">New Images (will be uploaded)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {newImagePreviewUrls.map((url, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-xl overflow-hidden border-2 border-lime">
                      <Image
                        src={url}
                        alt={`New image ${index + 1}`}
                        width={300}
                        height={300}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeNewImage(index)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                    <div className="absolute bottom-2 left-2 bg-yellow text-ink px-2 py-1 text-xs font-bold rounded">
                      NEW
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-ink/20 rounded-xl p-8 text-center hover:border-lime transition-colors">
              <svg className="w-12 h-12 mx-auto mb-4 text-ink/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="text-ink/70 font-medium mb-1">Click to add more images</p>
              <p className="text-xs text-ink/50">PNG, JPG up to 5MB</p>
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
          </label>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-4">
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={() => router.push('/admin/products')}
            disabled={saving}
          >
            Cancel
          </Button>
          <div className="flex gap-4">
            <Button
              type="button"
              variant="secondary"
              size="lg"
              onClick={handleSaveDraft}
              disabled={saving}
              className="rounded-xl font-bold"
            >
              {saving ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button
              type="button"
              variant="accent"
              size="lg"
              onClick={handlePublish}
              disabled={saving}
              className="rounded-xl font-bold"
            >
              {saving ? 'Saving...' : 'Update & Publish'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
