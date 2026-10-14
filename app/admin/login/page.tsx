'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import Image from 'next/image';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    console.log('Attempting login with:', email);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Login response:', { data, error });

      if (error) {
        console.error('Supabase auth error:', error);
        throw error;
      }

      if (data.user) {
        console.log('Login successful, user:', data.user.email);
        // Use window.location for immediate redirect
        window.location.href = '/admin';
      } else {
        throw new Error('No user returned from Supabase');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image
            src="/mivo-logo-full.png"
            alt="MIVO"
            width={280}
            height={80}
            className="h-16 w-auto mx-auto mb-4"
            priority
          />
          <h1 className="text-3xl font-bold font-handwritten text-ink mb-2">
            Admin Login
          </h1>
          <p className="text-ink/60">Sign in to manage your MIVO store</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl border-2 border-ink/10 p-8 shadow-lg">
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm font-medium">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-ink mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                placeholder="admin@mivo.in"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-ink mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-3 border-2 border-ink/20 bg-white text-ink rounded-xl focus:border-lime focus:ring-2 focus:ring-lime/20 transition-all"
                placeholder="••••••••"
              />
            </div>

            <Button
              type="submit"
              variant="accent"
              size="lg"
              className="w-full rounded-xl font-bold"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>

        {/* Setup Instructions */}
        <div className="mt-6 bg-yellow/10 border-2 border-yellow/30 rounded-xl p-4">
          <p className="text-sm text-ink/70">
            <strong className="text-ink">First time setup?</strong> Create an admin account in your Supabase dashboard under Authentication → Users.
          </p>
        </div>
      </div>
    </div>
  );
}
