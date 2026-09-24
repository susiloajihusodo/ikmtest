import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabaseUrl = "https://pgonbbemrnebjlxibtyn.supabase.co";
const supabaseAnonKey = "sb_secret_dsVxHvTNdoD6vuCZ0yWDNw_v4J4Liuasb_secret_dsVxHvTNdoD6vuCZ0yWDNw_v4J4Liua";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
