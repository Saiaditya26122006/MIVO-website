import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AdminNav } from '@/components/admin/AdminNav';

export default async function QuotesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/admin/login');
  }

  const { data: quotes } = await supabase
    .from('custom_quotes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <div className="min-h-screen bg-cream">
      <AdminNav user={user} />

      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold font-handwritten text-ink mb-2">Custom Quotes</h1>
        <p className="text-lg text-ink/70 mb-8">Review and respond to quote requests</p>

        <div className="bg-white rounded-2xl border-2 border-ink/10 p-8">
          {!quotes || quotes.length === 0 ? (
            <p className="text-center text-ink/60">No quote requests yet</p>
          ) : (
            <div className="space-y-4">
              {quotes.map((quote) => (
                <div key={quote.id} className="border-2 border-ink/10 rounded-xl p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-ink text-lg">{quote.customer_name}</h3>
                      <p className="text-ink/60">{quote.email}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      quote.status === 'submitted' ? 'bg-yellow/20 text-yellow-800' :
                      quote.status === 'reviewing' ? 'bg-blue/20 text-blue-800' :
                      quote.status === 'quoted' ? 'bg-lime/20 text-lime-800' :
                      'bg-gray/20 text-gray-800'
                    }`}>
                      {quote.status}
                    </span>
                  </div>
                  <p className="text-ink/70 mb-4">{quote.project_description}</p>
                  <div className="text-sm text-ink/50">
                    Quantity: {quote.quantity} | Created: {new Date(quote.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
