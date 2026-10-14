'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export default function CustomOrderPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    projectType: 'prototype',
    description: '',
    quantity: '1',
    material: 'pla',
    budget: '',
    timeline: 'flexible',
  });

  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Implement actual form submission to Supabase
    await new Promise((resolve) => setTimeout(resolve, 1500));

    alert('Quote request submitted! We will contact you shortly.');
    setIsSubmitting(false);

    // Reset form
    setFormData({
      name: '',
      email: '',
      phone: '',
      projectType: 'prototype',
      description: '',
      quantity: '1',
      material: 'pla',
      budget: '',
      timeline: 'flexible',
    });
    setFile(null);
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

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
              Custom 3D Printing
            </h1>
            <p className="text-xl text-cream/80 max-w-2xl">
              Have a unique project? Get a personalized quote for your custom 3D printing needs
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Form */}
          <motion.div
            className="lg:col-span-2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Contact Information */}
              <div className="bg-white border-2 border-ink/10 p-8 space-y-6">
                <h2 className="text-2xl font-bold text-ink mb-4">
                  Contact Information
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      Name *
                    </label>
                    <Input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder="Your name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      Email *
                    </label>
                    <Input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                      placeholder="your@email.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Phone Number *
                  </label>
                  <Input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    required
                    placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>

              {/* Project Details */}
              <div className="bg-white border-2 border-ink/10 p-8 space-y-6">
                <h2 className="text-2xl font-bold text-ink mb-4">
                  Project Details
                </h2>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Project Type *
                  </label>
                  <select
                    name="projectType"
                    value={formData.projectType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 border-2 border-ink/20 bg-cream text-ink focus:border-ink focus:ring-2 focus:ring-ink/20 transition-all"
                    required
                  >
                    <option value="prototype">Prototype</option>
                    <option value="product">Product Design</option>
                    <option value="figurine">Custom Figurine</option>
                    <option value="replacement">Replacement Part</option>
                    <option value="architectural">Architectural Model</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Project Description *
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    rows={5}
                    className="w-full px-4 py-3 border-2 border-ink/20 bg-cream text-ink placeholder:text-ink/40 focus:border-ink focus:ring-2 focus:ring-ink/20 transition-all"
                    placeholder="Describe your project in detail..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      Quantity
                    </label>
                    <Input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleChange}
                      min="1"
                      placeholder="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      Preferred Material
                    </label>
                    <select
                      name="material"
                      value={formData.material}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-ink/20 bg-cream text-ink focus:border-ink focus:ring-2 focus:ring-ink/20 transition-all"
                    >
                      <option value="pla">PLA (Standard)</option>
                      <option value="petg">PETG (Durable)</option>
                      <option value="abs">ABS (Strong)</option>
                      <option value="tpu">TPU (Flexible)</option>
                      <option value="resin">Resin (High Detail)</option>
                      <option value="not-sure">Not Sure</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-2">
                    Upload Reference Images (Optional)
                  </label>
                  <div className="border-2 border-dashed border-ink/20 p-8 text-center hover:border-ink/40 transition-all">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      accept=".png,.jpg,.jpeg,.pdf,.webp"
                      className="hidden"
                      id="file-upload"
                    />
                    <label
                      htmlFor="file-upload"
                      className="cursor-pointer text-ink/60 hover:text-ink"
                    >
                      {file ? (
                        <div>
                          <div className="text-4xl mb-2">📄</div>
                          <p className="font-medium">{file.name}</p>
                          <p className="text-sm text-ink/40 mt-1">
                            Click to change file
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="text-4xl mb-2">📁</div>
                          <p className="font-medium">
                            Click to upload or drag and drop
                          </p>
                          <p className="text-sm text-ink/40 mt-1">
                            Images or PDFs (Max 10MB)
                          </p>
                        </div>
                      )}
                    </label>
                  </div>
                </div>
              </div>

              {/* Budget & Timeline */}
              <div className="bg-white border-2 border-ink/10 p-8 space-y-6">
                <h2 className="text-2xl font-bold text-ink mb-4">
                  Budget & Timeline
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      Budget Range (₹)
                    </label>
                    <Input
                      type="text"
                      name="budget"
                      value={formData.budget}
                      onChange={handleChange}
                      placeholder="e.g., 5000-10000"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-ink mb-2">
                      Timeline
                    </label>
                    <select
                      name="timeline"
                      value={formData.timeline}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-ink/20 bg-cream text-ink focus:border-ink focus:ring-2 focus:ring-ink/20 transition-all"
                    >
                      <option value="urgent">Urgent (1-3 days)</option>
                      <option value="standard">Standard (1 week)</option>
                      <option value="flexible">Flexible (2+ weeks)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Request Quote'}
              </Button>
            </form>
          </motion.div>

          {/* Sidebar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-6"
          >
            {/* Process */}
            <div className="bg-white border-2 border-ink/10 p-6">
              <h3 className="text-xl font-bold text-ink mb-4">Our Process</h3>
              <ol className="space-y-4">
                {[
                  'Submit your request',
                  'Receive quote within 24 hours',
                  'Approve and pay',
                  'We print and deliver',
                ].map((step, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-lime text-ink rounded-full flex items-center justify-center font-bold">
                      {index + 1}
                    </div>
                    <p className="text-ink/80 pt-1">{step}</p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Contact Options */}
            <div className="bg-lime/20 border border-ink/10 p-6">
              <h3 className="text-xl font-bold text-ink mb-4">Need Help?</h3>
              <p className="text-ink/80 mb-4">
                Have questions? Reach out to us directly
              </p>
              <div className="space-y-3">
                <Button
                  variant="primary"
                  className="w-full"
                  onClick={() =>
                    window.open('https://wa.me/YOUR_PHONE', '_blank')
                  }
                >
                  <span className="mr-2">💬</span>
                  WhatsApp
                </Button>
                <a href="mailto:hello@mivo.com">
                  <Button variant="secondary" className="w-full">
                    <span className="mr-2">✉️</span>
                    Email Us
                  </Button>
                </a>
              </div>
            </div>

            {/* Capabilities */}
            <div className="bg-white border-2 border-ink/10 p-6">
              <h3 className="text-xl font-bold text-ink mb-4">
                What We Can Do
              </h3>
              <ul className="space-y-2 text-sm text-ink/80">
                <li className="flex items-center gap-2">
                  <span className="text-lime">✓</span>
                  CAD design services
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lime">✓</span>
                  Rapid prototyping
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lime">✓</span>
                  Small to large batches
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lime">✓</span>
                  Multiple materials
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-lime">✓</span>
                  Post-processing
                </li>
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
