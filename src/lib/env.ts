const required = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
} as const;

const recommended = {
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
} as const;

if (typeof window === 'undefined') {
  const missing = Object.entries(required).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    throw new Error(`[env] Missing required environment variables: ${missing.join(', ')}`);
  }
  const missingRecommended = Object.entries(recommended).filter(([, v]) => !v).map(([k]) => k);
  if (missingRecommended.length) {
    const level = process.env.NODE_ENV === 'production' ? 'error' : 'warn';
    console[level](`[env] Missing recommended environment variables: ${missingRecommended.join(', ')}`);
  }
}

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  resendApiKey: process.env.RESEND_API_KEY,
  turnstileSecretKey: process.env.TURNSTILE_SECRET_KEY,
  adminPassword: process.env.ADMIN_PASSWORD,
};
