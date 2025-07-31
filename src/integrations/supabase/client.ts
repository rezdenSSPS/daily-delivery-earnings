import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Tyto hodnoty jsou veřejné a bezpečné pro použití v prohlížeči
const SUPABASE_URL = "https://vnrrbjlkgeioxonrgtog.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZucnJiamxrZ2Vpb3hvbnJndG9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MDA4NDIsImV4cCI6MjA2OTQ3Njg0Mn0.csaOxm99uF8Q_f9zyJnqYKsxSApScb7LVdR3qw7RUEM";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Toto je klíčová část pro zapamatování přihlášení:
    
    // 1. Říká Supabase, aby použil trvalé úložiště prohlížeče.
    //    Toto je moderní náhrada za cookies pro tento typ aplikací.
    storage: localStorage,    
    
    // 2. Explicitně zapíná pamatování session mezi návštěvami.
    persistSession: true,   
    
    // 3. Automaticky obnovuje přihlášení, aby nevypršelo.
    autoRefreshToken: true,
  }
});
