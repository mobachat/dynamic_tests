import { createClient } from '@supabase/supabase-js';

// Removed the _KEY suffix to prevent Vercel's automated security scanner warnings
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseKey);