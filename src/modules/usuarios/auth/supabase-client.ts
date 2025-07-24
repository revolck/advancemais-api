import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase configurado para autenticação
 * Utiliza variáveis de ambiente para configuração segura
 */
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Variáveis SUPABASE_URL e SUPABASE_KEY devem estar configuradas"
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);
