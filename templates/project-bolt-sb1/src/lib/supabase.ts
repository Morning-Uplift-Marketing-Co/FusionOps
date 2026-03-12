import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface LoanApplication {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  state: string;
  requested_amount: number;
}

export interface Review {
  id: string;
  customer_name: string;
  rating: number;
  quote: string;
  pet_type: string;
  is_featured: boolean;
}

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
}
