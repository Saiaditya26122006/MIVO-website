'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AdminNav } from '@/components/admin/AdminNav';
import { STLViewer } from '@/components/admin/STLViewer';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { MultipartUploader, type UploadProgress } from '@/lib/r2/multipart-uploader';

export default function NewProductPage() {
  const router = useRouter();
  const supabase = createClient();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('robotics');
  const [material, setMaterial] = useState('PLA');
  const [inStock, setInStock] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [tags, setTags] = useState('');

  // File state
  const [stlFile, setStlFile] = useState<File | null>(null);
  const [productImage, setProductImage] = useState<File | null>(null);
  const [previewColor, setPreviewColor] = useState('#B7FF2A');

  // Model orientation state
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [rotationZ, setRotationZ] = useState(0);

  // Model position state
  const [positionX, setPositionX] = useState(0);
  const [positionY, setPositionY] = useState(0);
  const [positionZ, setPositionZ] = useState(0);

  // Model scale state
  const [scale, setScale] = useState(1);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<any>(null);

  // Upload progress state
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [uploading, setUploading] = useState(false);

  // Load user
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user);
      else router.push('/admin/login');
    });
  }, [router, supabase]);

  const handleStlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log('STL upload triggered');
    const file = e.target.files?.[0];
    console.log('Selected file:', file);

    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('File details:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.stl')) {
      setError('Please upload a valid STL file');
      console.error('Invalid file type:', file.name);
      return;
    }

    // Note: No file size limit - R2 supports files over 1GB
    // Large files will be uploaded in chunks
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
    console.log('✓ STL file accepted:', file.name, `(${fileSizeMB} MB)`);

    if (file.size > 50 * 1024 * 1024) {
      console.log('📦 Large file detected - will use multipart upload to R2');
    }

    setStlFile(file);
    setError('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB');
      return;
    }

    setProductImage(file);
    setError('');
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

    if (!price || parseFloat(price) <= 0) {
      setError('Valid price is required');
      return;
    }

    if (!stlFile) {
      setError('STL file is required');
      return;
    }

    setLoading(true);
    setUploading(true);
    setError('');
    setUploadProgress(null);

    let uploader: MultipartUploader | null = null;

    try {
      console.log('📤 Starting upload process...');

      // Upload STL file to R2 using multipart upload
      console.log('📦 Uploading STL file to R2:', stlFile.name);
      console.log('📦 File size:', (stlFile.size / 1024 / 1024).toFixed(2), 'MB');

      uploader = new MultipartUploader({
        file: stlFile,
        partSize: 10 * 1024 * 1024, // 10MB parts
        maxRetries: 3,
        onProgress: (progress) => {
          setUploadProgress(progress);
          console.log(
            `📊 Upload progress: ${progress.percentage}% (${progress.uploadedParts}/${progress.totalParts} parts)`
          );
        },
        onError: (error) => {
          console.error('❌ Upload error:', error);
        },
      });

      const uploadResult = await uploader.start();
      console.log('✓ STL uploaded to R2:', uploadResult.key);

      setUploading(false);

      // Upload product image if provided (still use Supabase for images)
      let imagePath = null;
      if (productImage) {
        console.log('🖼️ Uploading product image:', productImage.name);
        const imageFileName = `${Date.now()}-${productImage.name}`;
        const { data: imageData, error: imageError } = await supabase.storage
          .from('product-images')
          .upload(imageFileName, productImage);

        if (imageError) throw imageError;
        imagePath = imageData.path;
        console.log('✓ Image uploaded:', imagePath);
      }

      // Create product in database
      console.log('💾 Creating product record...');

      // Debug: Check auth session before insert
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 Current session:', session ? 'Active' : 'None');
      console.log('🔐 User ID:', session?.user?.id);
      console.log('🔐 User email:', session?.user?.email);

      if (!session) {
        throw new Error('No active session - please log out and log back in');
      }

      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          name: name.trim(),
          description: description.trim(),
          long_description: longDescription.trim() || null,
          price: parseFloat(price),
          category,
          images: imagePath ? [imagePath] : [],
          model_file: null, // R2 files don't use Supabase model_file
          storage_provider: 'r2',
          storage_key: uploadResult.key,
          file_size_bytes: uploadResult.fileSize,
          storage_metadata: {
            uploaded_at: new Date().toISOString(),
            upload_id: uploadResult.uploadId,
            original_filename: stlFile.name,
          },
          in_stock: inStock,
          featured,
          published: publish,
          specifications: {
            Material: material,
          },
          tags: tags
            .split(',')
            .map((t) => t.trim())
            .filter((t) => t),
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

      // Detect CORS errors and provide helpful message
      let errorMessage = err.message || 'Failed to create product';

      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('CORS')) {
        errorMessage = 'Upload blocked by CORS policy. Configure R2 bucket CORS settings to allow requests from this origin. See R2_CORS_CONFIGURATION.md for instructions.';
      } else if (errorMessage.includes('Failed to upload part')) {
        // Extract more details from the error
        const match = errorMessage.match(/HTTP (\d+)/);
        if (match) {
          errorMessage = `Upload failed with HTTP ${match[1]}. ${errorMessage}`;
        }
      }

      setError(errorMessage);

      // Abort upload if still in progress
      if (uploader) {
        console.log('🚫 Aborting upload...');
        await uploader.abort().catch(console.error);
      }
    } finally {
      setLoading(false);
      setUploading(false);
      setUploadProgress(null);
    }
  };

  if (!user) {
    return <div className="min-h-screen bg-cream flex items-center justify-center">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-ink/70">Loading...</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav user={user} />

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold font-handwritten text-ink mb-2">
            Add New Product
          </h1>
          <p className="text-lg text-ink/70">Upload STL file and create a new product listing</p>
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
              {/* Spinner */}
              <div className="relative w-20 h-20 mx-auto mb-6">
                <div className="absolute inset-0 border-4 border-lime/30 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-lime border-t-transparent rounded-full animate-spin"></div>
                <div className="absolute inset-2 border-4 border-yellow/50 border-b-transparent rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }}></div>
              </div>

              <h3 className="text-2xl font-bold font-handwritten text-ink mb-2">
                {uploading ? 'Uploading STL File...' : 'Publishing Product...'}
              </h3>
              <p className="text-ink/70 mb-4">
                {uploading
                  ? 'Uploading to Cloudflare R2 storage...'
                  : 'Please wait while we create the product listing.'}
              </p>

              {/* Upload progress bar */}
              {uploadProgress && (
                <div className="mb-6">
                  <div className="w-full bg-ink/10 rounded-full h-3 mb-2 overflow-hidden">
                    <div
                      className="bg-lime h-full rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress.percentage}%` }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-sm text-ink/70">
                    <span>{uploadProgress.percentage}%</span>
                    <span>
                      {(uploadProgress.uploadedBytes / 1024 / 1024).toFixed(1)} MB / {(uploadProgress.totalBytes / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                  <p className="text-xs text-ink/60 mt-1">
                    Part {uploadProgress.uploadedParts} of {uploadProgress.totalParts}
                  </p>
                </div>
              )}

              {/* Progress steps */}
              <div className="space-y-2 text-sm text-left">
                <div className={`flex items-center gap-2 ${uploading ? 'text-ink' : 'text-ink/40'}`}>
                  <div className={`w-2 h-2 ${uploading ? 'bg-lime animate-pulse' : 'bg-lime'} rounded-full`}></div>
                  <span>{uploading ? 'Uploading STL file to R2...' : '✓ STL file uploaded'}</span>
                </div>
                {productImage && (
                  <div className={`flex items-center gap-2 ${!uploading && productImage ? 'text-ink' : 'text-ink/40'}`}>
                    <div className={`w-2 h-2 ${!uploading && productImage ? 'bg-yellow animate-pulse' : 'bg-yellow/30'} rounded-full`}></div>
                    <span>Uploading product image...</span>
                  </div>
                )}
                <div className={`flex items-center gap-2 ${!uploading ? 'text-ink' : 'text-ink/40'}`}>
                  <div className={`w-2 h-2 ${!uploading ? 'bg-orange animate-pulse' : 'bg-orange/30'} rounded-full`}></div>
                  <span>Creating product record...</span>
                </div>
              </div>

              <p className="text-xs text-ink/50 mt-4">
                {uploading
                  ? 'Large files are uploaded in parts for reliability'
                  : 'This may take a few moments'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - 3D Preview */}
          <div>
            <div className="bg-white rounded-2xl border-2 border-ink/10 p-6 mb-6">
              <h2 className="text-xl font-bold text-ink mb-4">3D Preview</h2>
              <div className="aspect-square relative">
                <STLViewer
                  file={stlFile}
                  color={previewColor}
                  rotationX={rotationX}
                  rotationY={rotationY}
                  rotationZ={rotationZ}
                  positionX={positionX}
                  positionY={positionY}
                  positionZ={positionZ}
                  scale={scale}
                />
              </div>

              {/* Model Orientation Controls */}
              {stlFile && (
                <div className="mt-4 space-y-3 p-4 bg-cream rounded-lg border border-ink/10">
                  <h3 className="text-sm font-bold text-ink mb-2">Orient Model</h3>

                  <div className="space-y-2">
                    <div>
                      <label className="text-xs font-semibold text-ink flex items-center justify-between">
                        <span>Rotate X: {rotationX}°</span>
                        <button onClick={() => setRotationX(0)} className="text-xs text-lime hover:underline">Reset</button>
                      </label>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={rotationX}
                        onChange={(e) => setRotationX(Number(e.target.value))}
                        className="w-full h-2 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-lime"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-ink flex items-center justify-between">
                        <span>Rotate Y: {rotationY}°</span>
                        <button onClick={() => setRotationY(0)} className="text-xs text-lime hover:underline">Reset</button>
                      </label>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={rotationY}
                        onChange={(e) => setRotationY(Number(e.target.value))}
                        className="w-full h-2 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-lime"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-ink flex items-center justify-between">
                        <span>Rotate Z: {rotationZ}°</span>
                        <button onClick={() => setRotationZ(0)} className="text-xs text-lime hover:underline">Reset</button>
                      </label>
                      <input
                        type="range"
                        min="-180"
                        max="180"
                        value={rotationZ}
                        onChange={(e) => setRotationZ(Number(e.target.value))}
                        className="w-full h-2 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-lime"
                      />
                    </div>

                    <button
                      onClick={() => {
                        setRotationX(0);
                        setRotationY(0);
                        setRotationZ(0);
                      }}
                      className="w-full mt-2 px-4 py-2 bg-white border-2 border-ink/20 rounded-lg text-sm font-semibold text-ink hover:border-lime hover:bg-lime/5 transition-all"
                    >
                      Reset All Rotations
                    </button>
                  </div>

                  <div className="mt-4 pt-4 border-t border-ink/10">
                    <h3 className="text-sm font-bold text-ink mb-2">Position Model</h3>

                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-semibold text-ink flex items-center justify-between">
                          <span>Position X: {positionX.toFixed(1)}</span>
                          <button onClick={() => setPositionX(0)} className="text-xs text-lime hover:underline">Reset</button>
                        </label>
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          step="0.1"
                          value={positionX}
                          onChange={(e) => setPositionX(Number(e.target.value))}
                          className="w-full h-2 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-lime"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-ink flex items-center justify-between">
                          <span>Position Y (Height): {positionY.toFixed(1)}</span>
                          <button onClick={() => setPositionY(0)} className="text-xs text-lime hover:underline">Reset</button>
                        </label>
                        <input
                          type="range"
                          min="-10"
                          max="20"
                          step="0.1"
                          value={positionY}
                          onChange={(e) => setPositionY(Number(e.target.value))}
                          className="w-full h-2 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-lime"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-ink flex items-center justify-between">
                          <span>Position Z: {positionZ.toFixed(1)}</span>
                          <button onClick={() => setPositionZ(0)} className="text-xs text-lime hover:underline">Reset</button>
                        </label>
                        <input
                          type="range"
                          min="-20"
                          max="20"
                          step="0.1"
                          value={positionZ}
                          onChange={(e) => setPositionZ(Number(e.target.value))}
                          className="w-full h-2 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-lime"
                        />
                      </div>

                      <button
                        onClick={() => {
                          setPositionX(0);
                          setPositionY(0);
                          setPositionZ(0);
                        }}
                        className="w-full mt-2 px-4 py-2 bg-white border-2 border-ink/20 rounded-lg text-sm font-semibold text-ink hover:border-lime hover:bg-lime/5 transition-all"
                      >
                        Reset All Positions
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-ink/10">
                    <h3 className="text-sm font-bold text-ink mb-2">Scale Model</h3>

                    <div className="space-y-2">
                      <div>
                        <label className="text-xs font-semibold text-ink flex items-center justify-between">
                          <span>Scale: {scale.toFixed(2)}x</span>
                          <button onClick={() => setScale(1)} className="text-xs text-lime hover:underline">Reset</button>
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="5"
                          step="0.05"
                          value={scale}
                          onChange={(e) => setScale(Number(e.target.value))}
                          className="w-full h-2 bg-ink/10 rounded-lg appearance-none cursor-pointer accent-lime"
                        />
                        <div className="flex justify-between text-[10px] text-ink/50 mt-1">
                          <span>0.1x (Tiny)</span>
                          <span>1x (Normal)</span>
                          <span>5x (Huge)</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setRotationX(0);
                      setRotationY(0);
                      setRotationZ(0);
                      setPositionX(0);
                      setPositionY(0);
                      setPositionZ(0);
                      setScale(1);
                    }}
                    className="w-full mt-4 px-4 py-2 bg-lime text-ink rounded-lg text-sm font-bold hover:bg-lime/80 transition-all"
                  >
                    Reset Everything
                  </button>
                </div>
              )}

              {/* Preview Color Picker */}
              <div className="mt-4 flex items-center gap-4">
                <label className="text-sm font-semibold text-ink">Preview Color:</label>
                <div className="flex gap-2">
                  {['#B7FF2A', '#101010', '#FFFFFF', '#4a7ba7', '#FF6A00'].map((color) => (
                    <button
                      key={color}
                      onClick={() => setPreviewColor(color)}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        previewColor === color ? 'border-ink scale-110' : 'border-ink/20'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="color"
                    value={previewColor}
                    onChange={(e) => setPreviewColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border-2 border-ink/20 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* STL File Upload */}
            <div className="bg-white rounded-2xl border-2 border-ink/10 p-6">
              <h3 className="text-lg font-bold text-ink mb-4">STL File *</h3>
              <input
                type="file"
                accept=".stl"
                onChange={handleStlUpload}
                className="hidden"
                id="stl-upload"
              />
              <label
                htmlFor="stl-upload"
                className="block w-full px-6 py-4 border-2 border-dashed border-ink/30 rounded-xl text-center cursor-pointer hover:border-lime hover:bg-lime/5 transition-all"
              >
                {stlFile ? (
                  <div>
                    <p className="font-semibold text-ink">{stlFile.name}</p>
                    <p className="text-sm text-ink/60 mt-1">
                      {(stlFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <svg
                      className="w-12 h-12 mx-auto mb-2 text-ink/40"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    <p className="font-medium text-ink">Click to upload STL file</p>
                    <p className="text-sm text-ink/60 mt-1">Supports files over 1GB</p>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Right Column - Product Details */}
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border-2 border-ink/10 p-6">
              <h2 className="text-xl font-bold text-ink mb-6">Product Details</h2>

              <div className="space-y-4">
                {/* Product Name */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">
                    Product Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., L298N Motor Driver Mount"
                    className="w-full px-4 py-3 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                  />
                </div>

                {/* Short Description */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">
                    Short Description *
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief description for product card"
                    rows={2}
                    className="w-full px-4 py-3 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all resize-none"
                  />
                </div>

                {/* Long Description */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">
                    Long Description
                  </label>
                  <textarea
                    value={longDescription}
                    onChange={(e) => setLongDescription(e.target.value)}
                    placeholder="Detailed description for product page"
                    rows={4}
                    className="w-full px-4 py-3 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all resize-none"
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="150"
                    min="0"
                    step="1"
                    className="w-full px-4 py-3 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">
                    Category *
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                  >
                    <option value="robotics">Robotics</option>
                    <option value="electronics">Electronics</option>
                    <option value="organization">Organization</option>
                    <option value="prototyping">Prototyping</option>
                  </select>
                </div>

                {/* Material */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">
                    Material
                  </label>
                  <select
                    value={material}
                    onChange={(e) => setMaterial(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                  >
                    <option value="PLA">PLA</option>
                    <option value="PETG">PETG</option>
                    <option value="ABS">ABS</option>
                    <option value="TPU">TPU</option>
                    <option value="Nylon">Nylon</option>
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    placeholder="robotics, motor, arduino"
                    className="w-full px-4 py-3 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                  />
                </div>

                {/* Product Image */}
                <div>
                  <label className="block text-sm font-semibold text-ink mb-2">
                    Product Image
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    id="image-upload"
                  />
                  <label
                    htmlFor="image-upload"
                    className="block w-full px-4 py-3 border-2 border-dashed border-ink/20 rounded-xl text-center cursor-pointer hover:border-lime hover:bg-lime/5 transition-all"
                  >
                    {productImage ? (
                      <p className="text-sm font-medium text-ink">{productImage.name}</p>
                    ) : (
                      <p className="text-sm text-ink/60">Upload product thumbnail (optional)</p>
                    )}
                  </label>
                </div>

                {/* Checkboxes */}
                <div className="space-y-3 pt-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inStock}
                      onChange={(e) => setInStock(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-ink/30 text-lime focus:ring-lime"
                    />
                    <span className="font-medium text-ink">In Stock</span>
                  </label>

                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={featured}
                      onChange={(e) => setFeatured(e.target.checked)}
                      className="w-5 h-5 rounded border-2 border-ink/30 text-lime focus:ring-lime"
                    />
                    <span className="font-medium text-ink">Featured Product</span>
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
                className="flex-1 rounded-xl"
              >
                {loading ? 'Saving...' : 'Save Draft'}
              </Button>
              <Button
                variant="accent"
                size="lg"
                onClick={handlePublish}
                disabled={loading}
                className="flex-1 rounded-xl font-bold"
              >
                {loading ? 'Publishing...' : 'Publish Product'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
