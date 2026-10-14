import { createClient } from '@/lib/supabase/server';

/**
 * Verify that the current user is an authenticated admin
 * Reuses the existing admin authorization pattern from the project
 *
 * @returns User object if authenticated and authorized, null otherwise
 */
export async function verifyAdminAuth() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  // Check if user email matches admin email
  // This matches the RLS policy: admin@mivo.in or the configured ADMIN_EMAIL
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@mivo.in';

  if (user.email !== adminEmail && user.email !== 'admin@mivo.in') {
    return null;
  }

  return user;
}

/**
 * Create an unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return Response.json(
    { error: message },
    { status: 401 }
  );
}

/**
 * Create an error response
 */
export function errorResponse(message: string, status: number = 500) {
  return Response.json(
    { error: message },
    { status }
  );
}
