import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

let supabaseInstance: SupabaseClient | null = null;

export const supabase = (() => {
  if (!supabaseInstance) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseInstance;
})();

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
