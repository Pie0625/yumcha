// Community settings. While supabaseUrl is empty, the cafe pages show "coming soon"
// instead of the community, so it is safe to leave this as it is until Supabase is set up.
//
// Both values below are PUBLIC and are meant to be in the website:
//   supabaseUrl      Project URL from Supabase (Project Settings > API)
//   supabaseAnonKey  the "anon public" key, or the newer "publishable" key (starts with sb_publishable_)
//
// NEVER put the "service_role" or "secret" key here, or anywhere in this repository.
// The security comes from the rules in supabase/schema.sql, not from hiding this key.
window.YUMCHA_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  // Turn on after you set up Google sign-in in Supabase (see README), or the button will fail.
  enableGoogle: false
};
