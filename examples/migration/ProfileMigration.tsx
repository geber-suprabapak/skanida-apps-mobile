/**
 * Profile Management Migration Example
 * Shows how to migrate profile operations from Supabase to Appwrite
 */

import { useState, useEffect } from "react";
import { Alert } from "react-native";
import useAuthStore from "~/store/authStore";

// === BEFORE: Using Supabase ===
import { supabase } from "~/utils/supabase";

// === AFTER: Using Appwrite ===
import { userProfilesService } from "~/utils/migration";
import { account } from "~/utils/appwrite";

export function ProfileWithSupabase() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [absenceNumber, setAbsenceNumber] = useState("");
  const [className, setClassName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((state) => state.user);

  // Load profile data
  useEffect(() => {
    loadProfileSupabase();
  }, []);

  const loadProfileSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error loading profile:", error);
        return;
      }

      if (data) {
        setName(data.full_name || "");
        setEmail(data.email || "");
        setAbsenceNumber(data.absence_number || "");
        setClassName(data.class_name || "");
        setAvatarUrl(data.avatar_url || "");
      }
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const updateProfileSupabase = async () => {
    try {
      setLoading(true);

      // Update auth user email if changed
      if (email !== user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email,
        });
        if (emailError) {
          Alert.alert("Error", "Gagal memperbarui email");
          return;
        }
      }

      // Upsert profile data
      const { error: profileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            user_id: user.id,
            full_name: name,
            email,
            absence_number: absenceNumber,
            class_name: className,
            avatar_url: avatarUrl,
          },
          { onConflict: "user_id" },
        );

      if (profileError) {
        Alert.alert("Error", "Gagal memperbarui profil");
        return;
      }

      Alert.alert("Sukses", "Profil berhasil diperbarui");
    } catch (error) {
      Alert.alert("Error", "Gagal memperbarui profil");
    } finally {
      setLoading(false);
    }
  };

  return null; // UI components would go here
}

export function ProfileWithAppwrite() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [absenceNumber, setAbsenceNumber] = useState("");
  const [className, setClassName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const user = useAuthStore((state) => state.user);

  // Load profile data
  useEffect(() => {
    loadProfileAppwrite();
  }, []);

  const loadProfileAppwrite = async () => {
    try {
      const result = await userProfilesService.getProfile(user.$id);

      if (!result.success) {
        console.log("No profile found, will create on save");
        return;
      }

      if (result.data) {
        setName(result.data.full_name || "");
        setEmail(result.data.email || "");
        setAbsenceNumber(result.data.absence_number || "");
        setClassName(result.data.class_name || "");
        setAvatarUrl(result.data.avatar_url || "");
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const updateProfileAppwrite = async () => {
    try {
      setLoading(true);

      // Update auth user email if changed
      if (email !== user.email) {
        const currentPassword = ""; // Would need to get from user input
        try {
          await account.updateEmail(email, currentPassword);
        } catch (emailError) {
          Alert.alert(
            "Error",
            "Gagal memperbarui email. Periksa password Anda.",
          );
          return;
        }
      }

      // Upsert profile data
      const result = await userProfilesService.upsertProfile({
        user_id: user.$id,
        full_name: name,
        email,
        absence_number: absenceNumber,
        class_name: className,
        avatar_url: avatarUrl,
      });

      if (!result.success) {
        Alert.alert("Error", result.message);
        return;
      }

      Alert.alert("Sukses", "Profil berhasil diperbarui");
    } catch (error) {
      Alert.alert("Error", "Gagal memperbarui profil");
    } finally {
      setLoading(false);
    }
  };

  return null; // UI components would go here
}

// === MIGRATION COMPARISON ===
export const profileMigrationComparison = {
  loadProfile: {
    supabase: `
// Supabase - Load user profile
const { data, error } = await supabase
  .from('user_profiles')
  .select('*')
  .eq('user_id', user.id)
  .single();

if (data) {
  setName(data.full_name || '');
  setEmail(data.email || '');
}`,
    appwrite: `
// Appwrite - Load user profile
const result = await userProfilesService.getProfile(user.$id);

if (result.success && result.data) {
  setName(result.data.full_name || '');
  setEmail(result.data.email || '');
}`,
  },

  updateProfile: {
    supabase: `
// Supabase - Update profile
const { error } = await supabase
  .from('user_profiles')
  .upsert({
    user_id: user.id,
    full_name: name,
    email,
    absence_number: absenceNumber,
    class_name: className,
  }, { onConflict: 'user_id' });`,
    appwrite: `
// Appwrite - Update profile
const result = await userProfilesService.upsertProfile({
  user_id: user.$id,
  full_name: name,
  email,
  absence_number: absenceNumber,
  class_name: className,
});`,
  },

  updateEmail: {
    supabase: `
// Supabase - Update user email
const { error } = await supabase.auth.updateUser({
  email: newEmail,
});`,
    appwrite: `
// Appwrite - Update user email
await account.updateEmail(newEmail, currentPassword);`,
  },
};

/**
 * Migration Steps for Profile Management:
 *
 * 1. Replace Supabase table queries with Appwrite collection operations
 * 2. Update user ID references (user.id → user.$id)
 * 3. Adapt error handling for different response formats
 * 4. Handle email updates requiring current password in Appwrite
 * 5. Update data structure references for Appwrite documents
 *
 * Key Differences:
 * - Supabase uses user.id, Appwrite uses user.$id
 * - Supabase upsert vs Appwrite create/update logic
 * - Email updates in Appwrite require current password
 * - Error handling patterns differ between platforms
 * - Document structure includes Appwrite metadata fields
 */
