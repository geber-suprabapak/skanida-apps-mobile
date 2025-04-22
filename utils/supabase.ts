import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://uacjwtyhlrwojwqdanop.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVhY2p3dHlobHJ3b2p3cWRhbm9wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDE5MjUyOTQsImV4cCI6MjA1NzUwMTI5NH0.Wyz6XX7iIDD-GmncbFknaG1obnx2rkQudYbShDRE7yw";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
