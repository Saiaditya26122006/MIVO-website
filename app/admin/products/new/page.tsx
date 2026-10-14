'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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

export default function NewProductPage() {
  const router = useRouter();

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
  const [productImages, setProductImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  // Load user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
      else router.push('/admin/login');
    });
  }, [router]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      imagePreviewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types and sizes
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
      setProductImages([...productImages, ...validFiles]);
      setImagePreviewUrls([...imagePreviewUrls, ...newPreviewUrls]);
      setError('');
    }
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviewUrls[index]);
    setProductImages(productImages.filter((_, i) => i !== index));
    setImagePreviewUrls(imagePreviewUrls.filter((_, i) => i !== index));
  };

  const moveImage = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= productImages.length) return;

    const newImages = [...productImages];
    const newUrls = [...imagePreviewUrls];

    [newImages[index], newImages[newIndex]] = [newImages[newIndex], newImages[index]];
    [newUrls[index], newUrls[newIndex]] = [newUrls[newIndex], newUrls[index]];

    setProductImages(newImages);
    setImagePreviewUrls(newUrls);
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

  // Required info management for quote-based
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
      // Validate size options
      for (const size of sizeOptions) {
        if (!size.name.trim() || !size.dimensions.trim() || size.price <= 0) {
          setError('All size options must have a name, dimensions, and valid price');
          return;
        }
      }
      // Validate material options
      for (const mat of materialOptions) {
        if (!mat.name.trim()) {
          setError('All material options must have a name');
          return;
        }
      }
      // Validate color options
      for (const col of colorOptions) {
        if (!col.name.trim()) {
          setError('All color options must have a name');
          return;
        }
      }
    }

    if (productImages.length === 0) {
      setError('At least one product image is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const supabase = createClient();
      console.log('📤 Starting product creation...');

      // Upload all product images to Supabase storage
      const uploadedImagePaths: string[] = [];

      for (let i = 0; i < productImages.length; i++) {
        const image = productImages[i];
        console.log(`🖼️ Uploading image ${i + 1}/${productImages.length}:`, image.name);

        const imageFileName = `${Date.now()}-${i}-${image.name}`;
        const { data: imageData, error: imageError } = await supabase.storage
          .from('product-images')
          .upload(imageFileName, image);

        if (imageError) throw imageError;
        uploadedImagePaths.push(imageData.path);
        console.log(`✓ Image ${i + 1} uploaded:`, imageData.path);
      }

      // Create product in database
      console.log('💾 Creating product record...');

      // Check auth session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session - please log out and log back in');
      }

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
        // Set legacy price to base price or first size price
        legacyPrice = sizeOptions.length > 0 ? sizeOptions[0].price : parseFloat(basePrice);
      } else {
        // quote-based
        pricingConfig = {
          requiredInfo,
          referencePhotosRequired,
        };
        legacyPrice = 0;
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          name: name.trim(),
          description: description.trim(),
          long_description: longDescription.trim() || null,
          price: legacyPrice, // Legacy field for backward compatibility
          category,
          images: uploadedImagePaths,
          in_stock: inStock,
          featured,
          published: publish,
          specifications,
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t),
          // New pricing fields
          pricing_method: pricingMethod,
          pricing_config: pricingConfig,
          production_time_days: productionTimeDays ? parseInt(productionTimeDays) : null,
          min_quantity: parseInt(minQuantity),
          max_quantity: parseInt(maxQuantity),
        })
        .select()
        .single();

      if (productError) throw productError;
      console.log('✓ Product created:', product.id);

      // Success!
      console.log('🎉 Product published successfully!');
      router.push('/admin/products');
    } catch (err: any) {
      console.error('❌ Error creating product:', err);
      setError(err.message || 'Failed to create product');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink/70">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-handwritten text-ink mb-2">
            Add New Product
          </h1>
          <p className="text-lg text-ink/70">Create a new product listing with photos and details</p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        )}

        {/* Publishing Loading Overlay */}
        {loading && (
          <div className="fixed inset-0 bg-ink/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl border-2 border-lime p-8 max-w-md mx-4 text-center">
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-lime/30 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-lime border-t-transparent rounded-full animate-spin"></div>
              </div>
              <h3 className="text-2xl font-bold font-handwritten text-ink mb-2">
                Creating Product...
              </h3>
              <p className="text-ink/70">
                Uploading images and saving product details
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Product Images */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-ink/10 p-6">
              <h2 className="text-2xl font-bold text-ink mb-4">Product Images</h2>
              <p className="text-sm text-ink/60 mb-4">
                Upload multiple images. First image will be the main product photo.
              </p>

              {/* Upload Button */}
              <label className="block mb-4">
                <div className="border-2 border-dashed border-lime/40 rounded-xl p-8 text-center hover:border-lime hover:bg-lime/5 transition-all cursor-pointer">
                  <svg className="w-12 h-12 mx-auto mb-4 text-lime" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-ink font-medium mb-2">Click to upload images</p>
                  <p className="text-sm text-ink/60">PNG, JPG up to 5MB each</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>

              {/* Image Previews */}
              {imagePreviewUrls.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-ink">Uploaded Images ({imagePreviewUrls.length})</h3>
                  {imagePreviewUrls.map((url, index) => (
                    <div key={index} className="flex items-center gap-3 bg-cream/50 p-3 rounded-lg border border-ink/10">
                      <div className="relative w-20 h-20 rounded overflow-hidden border-2 border-ink/10">
                        <Image
                          src={url}
                          alt={`Preview ${index + 1}`}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink">
                          {index === 0 ? 'Main Image' : `Image ${index + 1}`}
                        </p>
                        <p className="text-xs text-ink/60">{productImages[index].name}</p>
                      </div>
                      <div className="flex gap-2">
                        {index > 0 && (
                          <button
                            onClick={() => moveImage(index, 'up')}
                            className="p-2 hover:bg-ink/10 rounded transition-all"
                            title="Move up"
                          >
                            ↑
                          </button>
                        )}
                        {index < imagePreviewUrls.length - 1 && (
                          <button
                            onClick={() => moveImage(index, 'down')}
                            className="p-2 hover:bg-ink/10 rounded transition-all"
                            title="Move down"
                          >
                            ↓
                          </button>
                        )}
                        <button
                          onClick={() => removeImage(index)}
                          className="p-2 hover:bg-red-100 text-red-600 rounded transition-all"
                          title="Remove"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Product Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-ink/10 p-6">
              <h2 className="text-2xl font-bold text-ink mb-4">Product Details</h2>

              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                    placeholder="e.g., Custom Phone Stand"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Short Description *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                    placeholder="Brief description for product cards"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Long Description
                  </label>
                  <textarea
                    value={longDescription}
                    onChange={(e) => setLongDescription(e.target.value)}
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                    placeholder="Detailed product information"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                  >
                    <option value="robotics">Robotics</option>
                    <option value="electronics">Electronics</option>
                    <option value="organization">Organization</option>
                    <option value="prototyping">Prototyping</option>
                    <option value="home">Home & Decor</option>
                    <option value="toys">Toys & Games</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pricing Configuration */}
            <div className="bg-white rounded-2xl border-2 border-ink/10 p-6">
              <h2 className="text-2xl font-bold text-ink mb-2">Pricing Configuration</h2>
              <p className="text-sm text-ink/60 mb-4">
                Choose how customers will be charged for this product
              </p>

              {/* Pricing Method Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-ink mb-3">
                  Pricing Method *
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <label className="relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-lime/50"
                    style={{
                      borderColor: pricingMethod === 'fixed' ? '#C1FF72' : 'rgba(0,0,0,0.1)',
                      backgroundColor: pricingMethod === 'fixed' ? 'rgba(193,255,114,0.05)' : 'transparent',
                    }}>
                    <input
                      type="radio"
                      value="fixed"
                      checked={pricingMethod === 'fixed'}
                      onChange={(e) => setPricingMethod(e.target.value as PricingMethod)}
                      className="mt-1 w-4 h-4 text-lime focus:ring-lime"
                    />
                    <div className="ml-3 flex-1">
                      <span className="font-semibold text-ink block">Fixed Price</span>
                      <span className="text-sm text-ink/70">Single price for this product</span>
                    </div>
                  </label>

                  <label className="relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-lime/50"
                    style={{
                      borderColor: pricingMethod === 'configurable' ? '#C1FF72' : 'rgba(0,0,0,0.1)',
                      backgroundColor: pricingMethod === 'configurable' ? 'rgba(193,255,114,0.05)' : 'transparent',
                    }}>
                    <input
                      type="radio"
                      value="configurable"
                      checked={pricingMethod === 'configurable'}
                      onChange={(e) => setPricingMethod(e.target.value as PricingMethod)}
                      className="mt-1 w-4 h-4 text-lime focus:ring-lime"
                    />
                    <div className="ml-3 flex-1">
                      <span className="font-semibold text-ink block">Configurable Price</span>
                      <span className="text-sm text-ink/70">Price varies by size, material, or color options</span>
                    </div>
                  </label>

                  <label className="relative flex items-start p-4 border-2 rounded-lg cursor-pointer transition-all hover:border-lime/50"
                    style={{
                      borderColor: pricingMethod === 'quote' ? '#C1FF72' : 'rgba(0,0,0,0.1)',
                      backgroundColor: pricingMethod === 'quote' ? 'rgba(193,255,114,0.05)' : 'transparent',
                    }}>
                    <input
                      type="radio"
                      value="quote"
                      checked={pricingMethod === 'quote'}
                      onChange={(e) => setPricingMethod(e.target.value as PricingMethod)}
                      className="mt-1 w-4 h-4 text-lime focus:ring-lime"
                    />
                    <div className="ml-3 flex-1">
                      <span className="font-semibold text-ink block">Quote-based</span>
                      <span className="text-sm text-ink/70">Custom quote required, no upfront price</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Fixed Price Configuration */}
              {pricingMethod === 'fixed' && (
                <div className="space-y-4 p-4 bg-lime/5 rounded-lg border border-lime/20">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      Base Price (₹) *
                    </label>
                    <input
                      type="number"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                      placeholder="299"
                      step="0.01"
                      min="0"
                    />
                  </div>
                </div>
              )}

              {/* Configurable Price Configuration */}
              {pricingMethod === 'configurable' && (
                <div className="space-y-6 p-4 bg-lime/5 rounded-lg border border-lime/20">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      Base Price (₹) *
                    </label>
                    <input
                      type="number"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                      placeholder="299"
                      step="0.01"
                      min="0"
                    />
                    <p className="text-xs text-ink/60 mt-1">Starting price before customizations</p>
                  </div>

                  {/* Size Options */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-ink">Size Options</label>
                      <button
                        type="button"
                        onClick={addSizeOption}
                        className="px-3 py-1 text-sm bg-lime text-ink rounded-lg hover:bg-lime/80 transition-all"
                      >
                        + Add Size
                      </button>
                    </div>
                    {sizeOptions.length > 0 ? (
                      <div className="space-y-3">
                        {sizeOptions.map((size, index) => (
                          <div key={index} className="bg-white p-3 rounded-lg border border-ink/10">
                            <div className="grid grid-cols-12 gap-2 items-start">
                              <input
                                type="text"
                                value={size.name}
                                onChange={(e) => updateSizeOption(index, 'name', e.target.value)}
                                placeholder="e.g., Small"
                                className="col-span-3 px-3 py-2 border border-ink/20 rounded focus:border-lime text-sm"
                              />
                              <input
                                type="text"
                                value={size.dimensions}
                                onChange={(e) => updateSizeOption(index, 'dimensions', e.target.value)}
                                placeholder="e.g., 5x5x5cm"
                                className="col-span-4 px-3 py-2 border border-ink/20 rounded focus:border-lime text-sm"
                              />
                              <div className="col-span-3 relative">
                                <span className="absolute left-3 top-2 text-ink/60 text-sm">₹</span>
                                <input
                                  type="number"
                                  value={size.price || ''}
                                  onChange={(e) => updateSizeOption(index, 'price', parseFloat(e.target.value) || 0)}
                                  placeholder="199"
                                  className="w-full pl-7 pr-3 py-2 border border-ink/20 rounded focus:border-lime text-sm"
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                              <div className="col-span-2 flex gap-1">
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => moveSizeOption(index, 'up')}
                                    className="p-1 hover:bg-ink/10 rounded text-sm"
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                )}
                                {index < sizeOptions.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => moveSizeOption(index, 'down')}
                                    className="p-1 hover:bg-ink/10 rounded text-sm"
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeSizeOption(index)}
                                  className="p-1 hover:bg-red-100 text-red-600 rounded text-sm"
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-ink/50 italic">No size options added</p>
                    )}
                  </div>

                  {/* Material Options */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-ink">Material Options</label>
                      <button
                        type="button"
                        onClick={addMaterialOption}
                        className="px-3 py-1 text-sm bg-lime text-ink rounded-lg hover:bg-lime/80 transition-all"
                      >
                        + Add Material
                      </button>
                    </div>
                    {materialOptions.length > 0 ? (
                      <div className="space-y-3">
                        {materialOptions.map((material, index) => (
                          <div key={index} className="bg-white p-3 rounded-lg border border-ink/10">
                            <div className="grid grid-cols-12 gap-2 items-center">
                              <input
                                type="text"
                                value={material.name}
                                onChange={(e) => updateMaterialOption(index, 'name', e.target.value)}
                                placeholder="e.g., PLA"
                                className="col-span-6 px-3 py-2 border border-ink/20 rounded focus:border-lime text-sm"
                              />
                              <div className="col-span-4 relative">
                                <span className="absolute left-3 top-2 text-ink/60 text-sm">₹</span>
                                <input
                                  type="number"
                                  value={material.priceAdjustment || ''}
                                  onChange={(e) => updateMaterialOption(index, 'priceAdjustment', parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full pl-7 pr-3 py-2 border border-ink/20 rounded focus:border-lime text-sm"
                                  step="0.01"
                                />
                              </div>
                              <div className="col-span-2 flex gap-1">
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => moveMaterialOption(index, 'up')}
                                    className="p-1 hover:bg-ink/10 rounded text-sm"
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                )}
                                {index < materialOptions.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => moveMaterialOption(index, 'down')}
                                    className="p-1 hover:bg-ink/10 rounded text-sm"
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeMaterialOption(index)}
                                  className="p-1 hover:bg-red-100 text-red-600 rounded text-sm"
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-ink/50 mt-1 ml-1">Price adjustment (+ or -)</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-ink/50 italic">No material options added</p>
                    )}
                  </div>

                  {/* Color Options */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-medium text-ink">Color Options</label>
                      <button
                        type="button"
                        onClick={addColorOption}
                        className="px-3 py-1 text-sm bg-lime text-ink rounded-lg hover:bg-lime/80 transition-all"
                      >
                        + Add Color
                      </button>
                    </div>
                    {colorOptions.length > 0 ? (
                      <div className="space-y-3">
                        {colorOptions.map((color, index) => (
                          <div key={index} className="bg-white p-3 rounded-lg border border-ink/10">
                            <div className="grid grid-cols-12 gap-2 items-center">
                              <input
                                type="text"
                                value={color.name}
                                onChange={(e) => updateColorOption(index, 'name', e.target.value)}
                                placeholder="e.g., Black"
                                className="col-span-6 px-3 py-2 border border-ink/20 rounded focus:border-lime text-sm"
                              />
                              <div className="col-span-4 relative">
                                <span className="absolute left-3 top-2 text-ink/60 text-sm">₹</span>
                                <input
                                  type="number"
                                  value={color.additionalCharge || ''}
                                  onChange={(e) => updateColorOption(index, 'additionalCharge', parseFloat(e.target.value) || 0)}
                                  placeholder="0"
                                  className="w-full pl-7 pr-3 py-2 border border-ink/20 rounded focus:border-lime text-sm"
                                  step="0.01"
                                  min="0"
                                />
                              </div>
                              <div className="col-span-2 flex gap-1">
                                {index > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => moveColorOption(index, 'up')}
                                    className="p-1 hover:bg-ink/10 rounded text-sm"
                                    title="Move up"
                                  >
                                    ↑
                                  </button>
                                )}
                                {index < colorOptions.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => moveColorOption(index, 'down')}
                                    className="p-1 hover:bg-ink/10 rounded text-sm"
                                    title="Move down"
                                  >
                                    ↓
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => removeColorOption(index)}
                                  className="p-1 hover:bg-red-100 text-red-600 rounded text-sm"
                                  title="Remove"
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                            <p className="text-xs text-ink/50 mt-1 ml-1">Additional charge for this color</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-ink/50 italic">No color options added</p>
                    )}
                  </div>

                  {(sizeOptions.length === 0 && materialOptions.length === 0 && colorOptions.length === 0) && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-800">
                        Add at least one configuration option (size, material, or color) for configurable pricing.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Quote-based Configuration */}
              {pricingMethod === 'quote' && (
                <div className="space-y-4 p-4 bg-lime/5 rounded-lg border border-lime/20">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-3">
                      Required Information from Customer
                    </label>
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
                      <span className="text-sm font-medium text-ink">Require reference photos</span>
                    </label>
                    <p className="text-xs text-ink/60 mt-1 ml-6">Customer must upload photos for accurate quote</p>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      Quote-based products don't show a price. Customers submit a quote request with their requirements.
                    </p>
                  </div>
                </div>
              )}

              {/* Production & Quantity Settings */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Production Time (days)
                  </label>
                  <input
                    type="number"
                    value={productionTimeDays}
                    onChange={(e) => setProductionTimeDays(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                    placeholder="7"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Min Quantity
                  </label>
                  <input
                    type="number"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                    placeholder="1"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Max Quantity
                  </label>
                  <input
                    type="number"
                    value={maxQuantity}
                    onChange={(e) => setMaxQuantity(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                    placeholder="100"
                    min="1"
                  />
                </div>
              </div>
            </div>

            {/* Specifications */}
            <div className="bg-white rounded-2xl border-2 border-ink/10 p-6">
              <h2 className="text-2xl font-bold text-ink mb-4">Specifications</h2>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Material
                  </label>
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                  >
                    <option value="PLA">PLA</option>
                    <option value="ABS">ABS</option>
                    <option value="PETG">PETG</option>
                    <option value="TPU">TPU (Flexible)</option>
                    <option value="Nylon">Nylon</option>
                    <option value="Resin">Resin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Color
                  </label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                    placeholder="e.g., Black, White, Custom"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Dimensions
                  </label>
                  <input
                    type="text"
                    value={dimensions}
                    onChange={(e) => setDimensions(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                    placeholder="e.g., 10cm x 5cm x 3cm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Weight
                  </label>
                  <input
                    type="text"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                    placeholder="e.g., 50g"
                  />
                </div>
              </div>
            </div>

            {/* Additional Options */}
            <div className="bg-white rounded-2xl border-2 border-ink/10 p-6">
              <h2 className="text-2xl font-bold text-ink mb-4">Options</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 rounded-lg focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                    placeholder="custom, gadget, holder"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inStock}
                      onChange={(e) => setInStock(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-ink/20 text-lime focus:ring-lime"
                    />
                    <span className="text-sm font-medium text-ink">In Stock</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-ink/20 text-lime focus:ring-lime"
                    />
                    <span className="text-sm font-medium text-ink">Featured Product</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <Button
                variant="secondary"
                size="lg"
                onClick={handleSaveDraft}
                disabled={loading}
                className="flex-1"
              >
                Save as Draft
              </Button>
              <Button
                variant="accent"
                size="lg"
                onClick={handlePublish}
                disabled={loading}
                className="flex-1"
              >
                Publish Product
              </Button>
            </div>
          </div>
        </div>
      </div>
  );
}
