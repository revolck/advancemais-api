import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./env";

/**
 * Supabase client centralizado
 * Utiliza as configurações validadas em src/config/env
 */
export const supabase = createClient(
  supabaseConfig.url,
  supabaseConfig.key
);

