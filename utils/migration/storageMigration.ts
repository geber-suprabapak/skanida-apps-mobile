import { storage, appwriteConfig, ID } from "../appwrite";
import { supabase } from "../supabase";

/**
 * Storage Migration Utilities
 * Provides methods to migrate file storage from Supabase to Appwrite
 */

export interface StorageMigrationResult {
  success: boolean;
  message: string;
  data?: any;
  fileUrl?: string;
  error?: any;
}

/**
 * Appwrite Storage Service
 * Replaces Supabase Storage functionality
 */
export class AppwriteStorageService {
  /**
   * Upload file to Appwrite Storage
   * Equivalent to: supabase.storage.from(bucket).upload(path, file)
   */
  async uploadFile(
    bucketId: string,
    file: File | Blob,
    fileName?: string,
    permissions?: string[],
  ): Promise<StorageMigrationResult> {
    try {
      const fileId = fileName || ID.unique();
      const uploaded = await storage.createFile(
        bucketId,
        fileId,
        file as File, // Cast to File for Appwrite SDK
        permissions,
      );

      // Get file URL
      const fileUrl = storage.getFileView(bucketId, uploaded.$id);

      return {
        success: true,
        message: "File uploaded successfully",
        data: uploaded,
        fileUrl: fileUrl.toString(),
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "File upload failed",
        error,
      };
    }
  }

  /**
   * Get file URL from Appwrite Storage
   * Equivalent to: supabase.storage.from(bucket).getPublicUrl(path)
   */
  getFileUrl(bucketId: string, fileId: string): string {
    return storage.getFileView(bucketId, fileId).toString();
  }

  /**
   * Delete file from Appwrite Storage
   * Equivalent to: supabase.storage.from(bucket).remove([path])
   */
  async deleteFile(
    bucketId: string,
    fileId: string,
  ): Promise<StorageMigrationResult> {
    try {
      await storage.deleteFile(bucketId, fileId);
      return {
        success: true,
        message: "File deleted successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "File deletion failed",
        error,
      };
    }
  }

  /**
   * List files in bucket
   * Equivalent to: supabase.storage.from(bucket).list()
   */
  async listFiles(
    bucketId: string,
    limit?: number,
  ): Promise<StorageMigrationResult> {
    try {
      const files = await storage.listFiles(bucketId, [], limit?.toString());
      return {
        success: true,
        message: "Files retrieved successfully",
        data: files,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.message || "Failed to list files",
        error,
      };
    }
  }
}

/**
 * Attendance Photos Storage Service
 */
export class AttendancePhotosStorage extends AppwriteStorageService {
  private bucketId = appwriteConfig.attendancePhotosStorage;

  async uploadAttendancePhoto(
    file: File | Blob,
    fileName: string,
  ): Promise<StorageMigrationResult> {
    return this.uploadFile(this.bucketId, file, fileName);
  }

  getAttendancePhotoUrl(fileId: string): string {
    return this.getFileUrl(this.bucketId, fileId);
  }

  async deleteAttendancePhoto(fileId: string): Promise<StorageMigrationResult> {
    return this.deleteFile(this.bucketId, fileId);
  }
}

/**
 * Perizinan Documents Storage Service
 */
export class PerizinanStorage extends AppwriteStorageService {
  private bucketId = appwriteConfig.perizinanStorage;

  async uploadPerizinanDocument(
    file: File | Blob,
    fileName: string,
  ): Promise<StorageMigrationResult> {
    return this.uploadFile(this.bucketId, file, fileName);
  }

  getPerizinanDocumentUrl(fileId: string): string {
    return this.getFileUrl(this.bucketId, fileId);
  }

  async deletePerizinanDocument(
    fileId: string,
  ): Promise<StorageMigrationResult> {
    return this.deleteFile(this.bucketId, fileId);
  }
}

/**
 * Avatars Storage Service
 */
export class AvatarsStorage extends AppwriteStorageService {
  private bucketId = appwriteConfig.avatarsStorage;

  async uploadAvatar(
    file: File | Blob,
    fileName: string,
  ): Promise<StorageMigrationResult> {
    return this.uploadFile(this.bucketId, file, fileName);
  }

  getAvatarUrl(fileId: string): string {
    return this.getFileUrl(this.bucketId, fileId);
  }

  async deleteAvatar(fileId: string): Promise<StorageMigrationResult> {
    return this.deleteFile(this.bucketId, fileId);
  }
}

/**
 * File migration helper for React Native
 * Handles conversion between different file formats
 */
export class FileUploadHelper {
  /**
   * Convert React Native ImagePicker result to File/Blob for Appwrite
   */
  static async convertImagePickerResult(imageResult: any): Promise<Blob> {
    try {
      // For React Native, convert URI to Blob
      const response = await fetch(imageResult.uri);
      const blob = await response.blob();
      return blob;
    } catch (error) {
      throw new Error(`Failed to convert image: ${error}`);
    }
  }

  /**
   * Generate unique filename with timestamp
   */
  static generateFileName(
    prefix: string,
    extension: string,
    userId?: string,
  ): string {
    const timestamp = Date.now();
    const userPart = userId ? `_${userId}` : "";
    return `${prefix}_${timestamp}${userPart}.${extension}`;
  }

  /**
   * Extract file extension from URI or filename
   */
  static getFileExtension(fileUri: string): string {
    const parts = fileUri.split(".");
    return parts[parts.length - 1].toLowerCase();
  }
}

/**
 * Migration comparison examples for storage operations
 */
export const storageMigrationExamples = {
  uploadAttendancePhoto: {
    supabase: `
// Supabase - Upload attendance photo
const fileName = \`\${yyyy-mm-dd}_\${timestamp}_\${userId}.png\`;
const { data, error } = await supabase.storage
  .from('attendance-photos')
  .upload(fileName, fileBuffer, {
    contentType: 'image/png',
  });

if (!error) {
  const { data: urlData } = supabase.storage
    .from('attendance-photos')
    .getPublicUrl(data.path);
  photoUrl = urlData.publicUrl;
}`,
    appwrite: `
// Appwrite - Upload attendance photo
const attendanceStorage = new AttendancePhotosStorage();
const fileName = FileUploadHelper.generateFileName('attendance', 'png', userId);
const blob = await FileUploadHelper.convertImagePickerResult(imageResult);
const result = await attendanceStorage.uploadAttendancePhoto(blob, fileName);

if (result.success) {
  photoUrl = result.fileUrl;
}`,
  },

  uploadPerizinanDocument: {
    supabase: `
// Supabase - Upload perizinan document
const fileName = \`perizinan_\${Date.now()}_\${userId}.\${extension}\`;
const { data, error } = await supabase.storage
  .from('perizinan')
  .upload(fileName, fileBuffer);

const { data: urlData } = supabase.storage
  .from('perizinan')
  .getPublicUrl(data.path);`,
    appwrite: `
// Appwrite - Upload perizinan document
const perizinanStorage = new PerizinanStorage();
const fileName = FileUploadHelper.generateFileName('perizinan', extension, userId);
const blob = await FileUploadHelper.convertImagePickerResult(imageResult);
const result = await perizinanStorage.uploadPerizinanDocument(blob, fileName);`,
  },

  uploadAvatar: {
    supabase: `
// Supabase - Upload avatar
const fileName = \`avatar_\${userId}_\${Date.now()}.jpg\`;
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(fileName, file, {
    upsert: true,
  });`,
    appwrite: `
// Appwrite - Upload avatar
const avatarsStorage = new AvatarsStorage();
const fileName = FileUploadHelper.generateFileName('avatar', 'jpg', userId);
const blob = await FileUploadHelper.convertImagePickerResult(imageResult);
const result = await avatarsStorage.uploadAvatar(blob, fileName);`,
  },
};

// Export service instances
export const appwriteStorageService = new AppwriteStorageService();
export const attendancePhotosStorage = new AttendancePhotosStorage();
export const perizinanStorage = new PerizinanStorage();
export const avatarsStorage = new AvatarsStorage();
