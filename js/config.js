/*
  Ripeline settings for Supabase (the free service that runs accounts and sends the welcome email)

  These two values are PUBLIC by design: Supabase expects them to be inside the app.
  They only let the app ask Supabase to sign people up and log them in.

  NEVER put the "secret" / "service_role" key, a database password,
  or an email password in this file (or anywhere in the app).
*/
const SUPABASE_URL = "https://dncxneugcwdtkzetiaga.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ekUXPoYEIxZYNclDeWrXJg_oGE3a57i";
