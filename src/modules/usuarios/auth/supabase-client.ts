import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "../../../config/env";

/**
 * Cliente Supabase configurado para autenticação
 * Utiliza configurações centralizadas e validadas
 */
export const supabase = createClient(supabaseConfig.url, supabaseConfig.key);
