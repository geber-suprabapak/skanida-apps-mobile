import { account } from "../appwrite";
import { supabase } from "../supabase";

/**
 * Authentication Migration Utilities
 * Provides methods to migrate authentication from Supabase to Appwrite
 */

export interface AuthMigrationResult {
  success: boolean;
  message: string;
  userId?: string;
  error?: any;
}

/**
 * Appwrite Authentication Service
 * Replaces Supabase auth functionality
 */
export class AppwriteAuthService {
  /**
   * Sign in with email and password
   * Equivalent to: supabase.auth.signInWithPassword()
   */
  async signIn(email: string, password: string): Promise<AuthMigrationResult> {
    try {
      const session = await account.createEmailPasswordSession(email, password);
      return {
        success: true,
        message: "Login successful",
        userId: session.userId,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Login failed",
        error,
      };
    }
  }

  /**
   * Sign up with email and password
   * Equivalent to: supabase.auth.signUp()
   */
  async signUp(
    email: string,
    password: string,
    name?: string,
  ): Promise<AuthMigrationResult> {
    try {
      const user = await account.create("unique()", email, password, name);
      return {
        success: true,
        message: "Account created successfully",
        userId: user.$id,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Registration failed",
        error,
      };
    }
  }

  /**
   * Get current session
   * Equivalent to: supabase.auth.getSession()
   */
  async getSession(): Promise<AuthMigrationResult> {
    try {
      const user = await account.get();
      return {
        success: true,
        message: "Session found",
        userId: user.$id,
      };
    } catch (error: any) {
      return {
        success: false,
        message: "No active session",
        error,
      };
    }
  }

  /**
   * Sign out current user
   * Equivalent to: supabase.auth.signOut()
   */
  async signOut(): Promise<AuthMigrationResult> {
    try {
      await account.deleteSession("current");
      return {
        success: true,
        message: "Logout successful",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Logout failed",
        error,
      };
    }
  }

  /**
   * Update user password
   * Equivalent to: supabase.auth.updateUser({ password })
   */
  async updatePassword(
    password: string,
    oldPassword?: string,
  ): Promise<AuthMigrationResult> {
    try {
      await account.updatePassword(password, oldPassword);
      return {
        success: true,
        message: "Password updated successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Password update failed",
        error,
      };
    }
  }

  /**
   * Update user email
   * Equivalent to: supabase.auth.updateUser({ email })
   */
  async updateEmail(
    email: string,
    password: string,
  ): Promise<AuthMigrationResult> {
    try {
      await account.updateEmail(email, password);
      return {
        success: true,
        message: "Email updated successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Email update failed",
        error,
      };
    }
  }
}

/**
 * Migration comparison helper
 * Shows side-by-side comparison of Supabase vs Appwrite auth calls
 */
export const authMigrationExamples = {
  login: {
    supabase: `
// Supabase Login
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});
if (error) {
  console.error('Login error:', error.message);
} else {
  setUser(data.user);
  router.replace('/Dashboard');
}`,
    appwrite: `
// Appwrite Login
const authService = new AppwriteAuthService();
const result = await authService.signIn(email, password);
if (!result.success) {
  console.error('Login error:', result.message);
} else {
  // Get user details and set in store
  const user = await account.get();
  setUser(user);
  router.replace('/Dashboard');
}`,
  },

  register: {
    supabase: `
// Supabase Registration
const { data, error } = await supabase.auth.signUp({
  email,
  password,
});`,
    appwrite: `
// Appwrite Registration
const authService = new AppwriteAuthService();
const result = await authService.signUp(email, password, name);`,
  },

  getSession: {
    supabase: `
// Supabase Get Session
const { data: { session }, error } = await supabase.auth.getSession();
if (session?.user) {
  setUser(session.user);
}`,
    appwrite: `
// Appwrite Get Session
const authService = new AppwriteAuthService();
const result = await authService.getSession();
if (result.success) {
  const user = await account.get();
  setUser(user);
}`,
  },
};

// Export singleton instance for easy use
export const appwriteAuth = new AppwriteAuthService();
