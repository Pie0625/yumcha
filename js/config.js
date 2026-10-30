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
  supabaseUrl: 'https://cvzsebcufschqpahdbxa.supabase.co/rest/v1/',
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2enNlYmN1ZnNjaHFwYWhkYnhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzMjkwNzcsImV4cCI6MjEwODkwNTA3N30.kVgCYo2fv6SCE0aaetbSmuvZnj3Qazkaw0B3NuLCXKg',
  // Turn on after you set up Google sign-in in Supabase (see README), or the button will fail.
  enableGoogle: false
};
