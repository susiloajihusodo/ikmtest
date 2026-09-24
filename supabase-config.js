// Ganti dengan kredensial project Supabase Anda
const supabaseUrl = "https://pgonbbemrnebzlxibtyn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnb25iYmVtcm5lYnpseGlidHluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNjI3MzMsImV4cCI6MjEwNTgzODczM30.6Fm9VRxiE5g7Uw5JKEEBTBMUyHula1KcLytlCXrJJ5k";

window.supabaseClient = supabase.createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
