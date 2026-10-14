'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import type { User } from '@supabase/supabase-js';

export function AdminNav({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/admin/login');
    router.refresh();
  };

  const navLinks = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/products', label: 'Products' },
    { href: '/admin/orders', label: 'Orders' },
    { href: '/admin/quotes', label: 'Quotes' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white border-b-2 border-ink/10 shadow-sm">
      <nav className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link href="/admin" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
            <Image
              src="/mivo-logo-full.png"
              alt="MIVO Admin"
              width={200}
              height={60}
              className="h-12 w-auto"
              priority
            />
            <span className="text-xs font-bold uppercase tracking-wider text-lime bg-lime/10 px-2 py-1 rounded-md">
              Admin
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-base font-semibold transition-colors duration-200 ${
                  pathname === link.href
                    ? 'text-lime'
                    : 'text-ink hover:text-lime'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Side */}
          <div className="flex items-center gap-4">
            <Link href="/" target="_blank">
              <Button variant="ghost" size="sm" className="hidden md:flex">
                View Store →
              </Button>
            </Link>
            <div className="flex items-center gap-3 px-4 py-2 bg-cream rounded-full">
              <div className="w-8 h-8 bg-lime rounded-full flex items-center justify-center">
                <span className="text-ink font-bold text-sm">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-medium text-ink hidden md:block">
                {user.email}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-red-600 hover:bg-red-50"
            >
              Logout
            </Button>
          </div>
        </div>
      </nav>
    </header>
  );
}
