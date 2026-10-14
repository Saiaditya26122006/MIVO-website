'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function TestPage() {
  const [results, setResults] = useState<any>({});

  useEffect(() => {
    const supabase = createClient();
    async function runTests() {
      const testResults: any = {
        auth: 'Testing...',
        products: 'Testing...',
        orders: 'Testing...',
        quotes: 'Testing...',
        storage: 'Testing...',
      };

      // Test auth
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        testResults.auth = `❌ ${authError.message}`;
      } else {
        testResults.auth = userData.user ? `✓ Logged in as ${userData.user.email}` : '❌ Not logged in';
      }

      // Test products table
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('id')
        .limit(1);

      if (prodError) {
        testResults.products = `❌ ${prodError.message}`;
      } else {
        testResults.products = `✓ Table exists (${products?.length || 0} products)`;
      }

      // Test orders table
      const { data: orders, error: ordError } = await supabase
        .from('orders')
        .select('id')
        .limit(1);

      if (ordError) {
        testResults.orders = `❌ ${ordError.message}`;
      } else {
        testResults.orders = `✓ Table exists`;
      }

      // Test quotes table
      const { data: quotes, error: quoteError } = await supabase
        .from('custom_quotes')
        .select('id')
        .limit(1);

      if (quoteError) {
        testResults.quotes = `❌ ${quoteError.message}`;
      } else {
        testResults.quotes = `✓ Table exists`;
      }

      // Test storage
      const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
      if (bucketError) {
        testResults.storage = `❌ ${bucketError.message}`;
      } else {
        const hasImages = buckets?.find(b => b.name === 'product-images');
        const hasStl = buckets?.find(b => b.name === 'product-stl-files');
        testResults.storage = `${hasImages ? '✓' : '❌'} product-images, ${hasStl ? '✓' : '❌'} product-stl-files`;
      }

      setResults(testResults);
    }

    runTests();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-ink mb-8">Admin System Test</h1>

        <div className="bg-white rounded-2xl border-2 border-ink/10 p-8 space-y-4">
          <div>
            <strong className="text-ink">Authentication:</strong>
            <p className="text-ink/70 font-mono text-sm mt-1">{results.auth}</p>
          </div>

          <div>
            <strong className="text-ink">Products Table:</strong>
            <p className="text-ink/70 font-mono text-sm mt-1">{results.products}</p>
          </div>

          <div>
            <strong className="text-ink">Orders Table:</strong>
            <p className="text-ink/70 font-mono text-sm mt-1">{results.orders}</p>
          </div>

          <div>
            <strong className="text-ink">Quotes Table:</strong>
            <p className="text-ink/70 font-mono text-sm mt-1">{results.quotes}</p>
          </div>

          <div>
            <strong className="text-ink">Storage Buckets:</strong>
            <p className="text-ink/70 font-mono text-sm mt-1">{results.storage}</p>
          </div>
        </div>

        <div className="mt-8 bg-yellow/10 border-2 border-yellow/30 rounded-xl p-6">
          <h2 className="font-bold text-ink mb-2">If you see errors:</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-ink/70">
            <li>Tables "does not exist" → Run supabase-schema.sql in SQL Editor</li>
            <li>Storage buckets missing → Create them in Supabase Storage</li>
            <li>"permission denied" → Check RLS policies in database</li>
          </ol>
        </div>
      </div>
  );
}
