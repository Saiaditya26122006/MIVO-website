'use client';

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

export default function ContactPage() {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Message sent! We will get back to you soon.');
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
              Get in Touch
            </h1>
            <p className="text-xl text-cream/80">
              We'd love to hear from you
            </p>
          </motion.div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Name
                </label>
                <Input type="text" placeholder="Your name" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Email
                </label>
                <Input type="email" placeholder="your@email.com" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Subject
                </label>
                <Input type="text" placeholder="How can we help?" required />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink mb-2">
                  Message
                </label>
                <textarea
                  rows={6}
                  className="w-full px-4 py-3 border-2 border-ink/20 bg-cream text-ink placeholder:text-ink/40 focus:border-ink focus:ring-2 focus:ring-ink/20 transition-all"
                  placeholder="Tell us more..."
                  required
                />
              </div>

              <Button type="submit" variant="accent" size="lg" className="w-full">
                Send Message
              </Button>
            </form>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="space-y-8"
          >
            <div className="bg-white border-2 border-ink/10 p-8">
              <h2 className="text-2xl font-bold text-ink mb-6">
                Contact Information
              </h2>
              <div className="space-y-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">📧</span>
                    <h3 className="font-semibold text-ink">Email</h3>
                  </div>
                  <a
                    href="mailto:hello@mivo.com"
                    className="text-ink/70 hover:text-lime transition-colors"
                  >
                    hello@mivo.com
                  </a>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">📱</span>
                    <h3 className="font-semibold text-ink">Phone</h3>
                  </div>
                  <a
                    href="tel:+91XXXXXXXXXX"
                    className="text-ink/70 hover:text-lime transition-colors"
                  >
                    +91 XXXXX XXXXX
                  </a>
                </div>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">💬</span>
                    <h3 className="font-semibold text-ink">WhatsApp</h3>
                  </div>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      window.open('https://wa.me/YOUR_PHONE', '_blank')
                    }
                  >
                    Message Us
                  </Button>
                </div>
              </div>
            </div>

            <div className="bg-lime/10 border border-ink/10 p-8">
              <h2 className="text-2xl font-bold text-ink mb-4">
                Business Hours
              </h2>
              <div className="space-y-2 text-ink/80">
                <p>Monday - Friday: 9:00 AM - 6:00 PM</p>
                <p>Saturday: 10:00 AM - 4:00 PM</p>
                <p>Sunday: Closed</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Contact page footer with discreet admin link */}
        <div className="relative mt-16 pb-8">
          <div className="text-center text-ink/40 text-sm">
            <Link
              href="/admin/login"
              className="absolute bottom-8 right-6 text-ink/30 hover:text-ink/50 text-xs transition-colors duration-200"
            >
              Admin
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
