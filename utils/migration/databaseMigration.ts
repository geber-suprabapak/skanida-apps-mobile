import { databases, appwriteConfig, ID } from "../appwrite";
import { supabase } from "../supabase";
import { Query } from "appwrite";

/**
 * Database Migration Utilities
 * Provides methods to migrate database operations from Supabase to Appwrite
 */

export interface DatabaseMigrationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: any;
}

/**
 * User Profiles Migration Service
 * Handles migration of user_profiles table from Supabase to Appwrite
 */
export class UserProfilesService {
  private collectionId = appwriteConfig.userProfilesCollectionId;
  private databaseId = appwriteConfig.databaseId;

  /**
   * Create or update user profile
   * Equivalent to: supabase.from('user_profiles').upsert()
   */
  async upsertProfile(profileData: {
    user_id: string;
    full_name?: string;
    email?: string;
    absence_number?: string;
    class_name?: string;
    avatar_url?: string;
    role?: string;
  }): Promise<DatabaseMigrationResult> {
    try {
      // Try to get existing profile first
      const existing = await this.getProfile(profileData.user_id);

      if (existing.success && existing.data) {
        // Update existing profile
        const updated = await databases.updateDocument(
          this.databaseId,
          this.collectionId,
          existing.data.$id,
          {
            full_name: profileData.full_name,
            email: profileData.email,
            absence_number: profileData.absence_number,
            class_name: profileData.class_name,
            avatar_url: profileData.avatar_url,
            role: profileData.role,
            updated_at: new Date().toISOString(),
          },
        );

        return {
          success: true,
          message: "Profile updated successfully",
          data: updated,
        };
      } else {
        // Create new profile
        const created = await databases.createDocument(
          this.databaseId,
          this.collectionId,
          ID.unique(),
          {
            user_id: profileData.user_id,
            full_name: profileData.full_name,
            email: profileData.email,
            absence_number: profileData.absence_number,
            class_name: profileData.class_name,
            avatar_url: profileData.avatar_url,
            role: profileData.role,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        );

        return {
          success: true,
          message: "Profile created successfully",
          data: created,
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to upsert profile",
        error,
      };
    }
  }

  /**
   * Get user profile by user_id
   * Equivalent to: supabase.from('user_profiles').select('*').eq('user_id', userId).single()
   */
  async getProfile(userId: string): Promise<DatabaseMigrationResult> {
    try {
      const response = await databases.listDocuments(
        this.databaseId,
        this.collectionId,
        [Query.equal("user_id", userId)],
      );

      if (response.documents.length > 0) {
        return {
          success: true,
          message: "Profile found",
          data: response.documents[0],
        };
      } else {
        return {
          success: false,
          message: "Profile not found",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to get profile",
        error,
      };
    }
  }
}

/**
 * Absences Migration Service
 * Handles migration of absences table from Supabase to Appwrite
 */
export class AbsencesService {
  private collectionId = appwriteConfig.absencesCollectionId;
  private databaseId = appwriteConfig.databaseId;

  /**
   * Create absence record
   * Equivalent to: supabase.from('absences').insert()
   */
  async createAbsence(absenceData: {
    user_id: string;
    date: string;
    status: "Hadir" | "Datang" | "Pulang";
    reason?: string;
    photo_url?: string;
    latitude?: number;
    longitude?: number;
  }): Promise<DatabaseMigrationResult> {
    try {
      const created = await databases.createDocument(
        this.databaseId,
        this.collectionId,
        ID.unique(),
        {
          user_id: absenceData.user_id,
          date: absenceData.date,
          status: absenceData.status,
          reason: absenceData.reason,
          photo_url: absenceData.photo_url,
          latitude: absenceData.latitude,
          longitude: absenceData.longitude,
          created_at: new Date().toISOString(),
        },
      );

      return {
        success: true,
        message: "Absence created successfully",
        data: created,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to create absence",
        error,
      };
    }
  }

  /**
   * Get absences for user
   * Equivalent to: supabase.from('absences').select('*').eq('user_id', userId)
   */
  async getUserAbsences(
    userId: string,
    limit?: number,
  ): Promise<DatabaseMigrationResult> {
    try {
      const queries = [
        Query.equal("user_id", userId),
        Query.orderDesc("created_at"),
      ];
      if (limit) {
        queries.push(Query.limit(limit));
      }

      const response = await databases.listDocuments(
        this.databaseId,
        this.collectionId,
        queries,
      );

      return {
        success: true,
        message: "Absences retrieved successfully",
        data: response.documents,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to get absences",
        error,
      };
    }
  }

  /**
   * Get last absence for user
   * Equivalent to: supabase.from('absences').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).single()
   */
  async getLastAbsence(userId: string): Promise<DatabaseMigrationResult> {
    try {
      const response = await databases.listDocuments(
        this.databaseId,
        this.collectionId,
        [
          Query.equal("user_id", userId),
          Query.orderDesc("created_at"),
          Query.limit(1),
        ],
      );

      if (response.documents.length > 0) {
        return {
          success: true,
          message: "Last absence found",
          data: response.documents[0],
        };
      } else {
        return {
          success: false,
          message: "No absences found",
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to get last absence",
        error,
      };
    }
  }
}

/**
 * Perizinan (Leave Requests) Migration Service
 * Handles migration of perizinan table from Supabase to Appwrite
 */
export class PerizinanService {
  private collectionId = appwriteConfig.perizinanCollectionId;
  private databaseId = appwriteConfig.databaseId;

  /**
   * Create leave request
   * Equivalent to: supabase.from('perizinan').insert()
   */
  async createLeaveRequest(leaveData: {
    user_id: string;
    kategori_izin: "sakit" | "pergi";
    deskripsi?: string;
    link_foto?: string;
    tanggal?: string;
  }): Promise<DatabaseMigrationResult> {
    try {
      const created = await databases.createDocument(
        this.databaseId,
        this.collectionId,
        ID.unique(),
        {
          user_id: leaveData.user_id,
          kategori_izin: leaveData.kategori_izin,
          deskripsi: leaveData.deskripsi,
          link_foto: leaveData.link_foto,
          tanggal: leaveData.tanggal || new Date().toISOString(),
          approval_status: "pending",
          status: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      );

      return {
        success: true,
        message: "Leave request created successfully",
        data: created,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to create leave request",
        error,
      };
    }
  }

  /**
   * Get leave requests for user
   * Equivalent to: supabase.from('perizinan').select('*').eq('user_id', userId)
   */
  async getUserLeaveRequests(userId: string): Promise<DatabaseMigrationResult> {
    try {
      const response = await databases.listDocuments(
        this.databaseId,
        this.collectionId,
        [Query.equal("user_id", userId), Query.orderDesc("tanggal")],
      );

      return {
        success: true,
        message: "Leave requests retrieved successfully",
        data: response.documents,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to get leave requests",
        error,
      };
    }
  }
}

/**
 * Migration comparison examples for database operations
 */
export const databaseMigrationExamples = {
  userProfile: {
    supabase: `
// Supabase - Upsert user profile
const { error } = await supabase
  .from('user_profiles')
  .upsert({
    user_id: user.id,
    full_name: name,
    email,
    absence_number: absenceNumber,
    class_name: className,
    avatar_url: avatarUrl,
  }, { onConflict: 'user_id' });`,
    appwrite: `
// Appwrite - Upsert user profile
const profileService = new UserProfilesService();
const result = await profileService.upsertProfile({
  user_id: user.$id,
  full_name: name,
  email,
  absence_number: absenceNumber,
  class_name: className,
  avatar_url: avatarUrl,
});`,
  },

  getAbsences: {
    supabase: `
// Supabase - Get user absences
const { data, error } = await supabase
  .from('absences')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });`,
    appwrite: `
// Appwrite - Get user absences
const absencesService = new AbsencesService();
const result = await absencesService.getUserAbsences(userId);
const absences = result.data;`,
  },

  createLeaveRequest: {
    supabase: `
// Supabase - Create leave request
const { data, error } = await supabase
  .from('perizinan')
  .insert({
    user_id: userId,
    kategori_izin: 'sakit',
    deskripsi: description,
    link_foto: photoUrl,
  });`,
    appwrite: `
// Appwrite - Create leave request
const perizinanService = new PerizinanService();
const result = await perizinanService.createLeaveRequest({
  user_id: userId,
  kategori_izin: 'sakit',
  deskripsi: description,
  link_foto: photoUrl,
});`,
  },
};

// Export service instances
export const userProfilesService = new UserProfilesService();
export const absencesService = new AbsencesService();
export const perizinanService = new PerizinanService();
