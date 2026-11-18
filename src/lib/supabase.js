import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
// Supabase's newer "publishable" key and the older "anon" key work the same way; either name is accepted.
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;
