/**
 * File Upload Migration Example
 * Shows how to migrate file upload operations from Supabase to Appwrite
 */

import { useState } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

// === BEFORE: Using Supabase ===
import { supabase } from "~/utils/supabase";

// === AFTER: Using Appwrite ===
import {
  attendancePhotosStorage,
  perizinanStorage,
  FileUploadHelper,
} from "~/utils/migration";

export function FileUploadWithSupabase() {
  const [uploading, setUploading] = useState(false);

  const uploadAttendancePhotoSupabase = async (
    imageUri: string,
    userId: string,
  ) => {
    try {
      setUploading(true);

      // Resize image
      const resizedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.PNG },
      );

      // Convert to file buffer
      const response = await fetch(resizedImage.uri);
      const fileBuffer = await response.arrayBuffer();

      // Generate filename
      const date = new Date();
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const timestamp = Date.now();
      const fileName = `${yyyy}-${mm}-${dd}_${timestamp}_${userId}.png`;

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from("attendance-photos")
        .upload(fileName, fileBuffer, {
          contentType: "image/png",
        });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("attendance-photos")
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Gagal mengupload foto");
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const uploadPerizinanDocumentSupabase = async (
    imageUri: string,
    userId: string,
  ) => {
    try {
      setUploading(true);

      const response = await fetch(imageUri);
      const fileBuffer = await response.arrayBuffer();

      const extension = imageUri.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `perizinan_${Date.now()}_${userId}.${extension}`;

      const { data, error } = await supabase.storage
        .from("perizinan")
        .upload(fileName, fileBuffer);

      if (error) {
        throw new Error(`Upload failed: ${error.message}`);
      }

      const { data: urlData } = supabase.storage
        .from("perizinan")
        .getPublicUrl(data.path);

      return urlData.publicUrl;
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Gagal mengupload dokumen");
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return null; // UI components would go here
}

export function FileUploadWithAppwrite() {
  const [uploading, setUploading] = useState(false);

  const uploadAttendancePhotoAppwrite = async (
    imageUri: string,
    userId: string,
  ) => {
    try {
      setUploading(true);

      // Resize image (same as before)
      const resizedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.PNG },
      );

      // Convert to blob for Appwrite
      const blob =
        await FileUploadHelper.convertImagePickerResult(resizedImage);

      // Generate filename
      const fileName = FileUploadHelper.generateFileName(
        "attendance",
        "png",
        userId,
      );

      // Upload to Appwrite Storage
      const result = await attendancePhotosStorage.uploadAttendancePhoto(
        blob,
        fileName,
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      return result.fileUrl;
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Gagal mengupload foto");
      throw error;
    } finally {
      setUploading(false);
    }
  };

  const uploadPerizinanDocumentAppwrite = async (
    imageUri: string,
    userId: string,
  ) => {
    try {
      setUploading(true);

      // Convert to blob
      const blob = await FileUploadHelper.convertImagePickerResult({
        uri: imageUri,
      });

      // Generate filename
      const extension = FileUploadHelper.getFileExtension(imageUri);
      const fileName = FileUploadHelper.generateFileName(
        "perizinan",
        extension,
        userId,
      );

      // Upload to Appwrite Storage
      const result = await perizinanStorage.uploadPerizinanDocument(
        blob,
        fileName,
      );

      if (!result.success) {
        throw new Error(result.message);
      }

      return result.fileUrl;
    } catch (error) {
      console.error("Upload error:", error);
      Alert.alert("Error", "Gagal mengupload dokumen");
      throw error;
    } finally {
      setUploading(false);
    }
  };

  return null; // UI components would go here
}

// === MIGRATION COMPARISON ===
export const fileUploadMigrationComparison = {
  attendancePhoto: {
    supabase: `
// Supabase - Upload attendance photo
const response = await fetch(resizedImage.uri);
const fileBuffer = await response.arrayBuffer();

const { data, error } = await supabase.storage
  .from('attendance-photos')
  .upload(fileName, fileBuffer, {
    contentType: 'image/png',
  });

const { data: urlData } = supabase.storage
  .from('attendance-photos')
  .getPublicUrl(data.path);

return urlData.publicUrl;`,
    appwrite: `
// Appwrite - Upload attendance photo
const blob = await FileUploadHelper.convertImagePickerResult(resizedImage);
const fileName = FileUploadHelper.generateFileName('attendance', 'png', userId);

const result = await attendancePhotosStorage.uploadAttendancePhoto(blob, fileName);

if (result.success) {
  return result.fileUrl;
}`,
  },

  perizinanDocument: {
    supabase: `
// Supabase - Upload perizinan document
const response = await fetch(imageUri);
const fileBuffer = await response.arrayBuffer();

const { data, error } = await supabase.storage
  .from('perizinan')
  .upload(fileName, fileBuffer);

const { data: urlData } = supabase.storage
  .from('perizinan')
  .getPublicUrl(data.path);`,
    appwrite: `
// Appwrite - Upload perizinan document
const blob = await FileUploadHelper.convertImagePickerResult({ uri: imageUri });
const fileName = FileUploadHelper.generateFileName('perizinan', extension, userId);

const result = await perizinanStorage.uploadPerizinanDocument(blob, fileName);`,
  },

  fileNameGeneration: {
    supabase: `
// Supabase - Manual filename generation
const date = new Date();
const yyyy = date.getFullYear();
const mm = String(date.getMonth() + 1).padStart(2, '0');
const dd = String(date.getDate()).padStart(2, '0');
const timestamp = Date.now();
const fileName = \`\${yyyy}-\${mm}-\${dd}_\${timestamp}_\${userId}.png\`;`,
    appwrite: `
// Appwrite - Helper for filename generation
const fileName = FileUploadHelper.generateFileName('attendance', 'png', userId);
// Generates: attendance_1703123456789_userId.png`,
  },
};

/**
 * Migration Steps for File Upload:
 *
 * 1. Replace Supabase storage calls with Appwrite storage services
 * 2. Convert ArrayBuffer to Blob for Appwrite compatibility
 * 3. Update file URL retrieval methods
 * 4. Implement consistent filename generation utilities
 * 5. Adapt error handling for Appwrite response format
 *
 * Key Differences:
 * - Supabase uses ArrayBuffer, Appwrite uses Blob/File
 * - Different methods for getting file URLs
 * - Appwrite file permissions are handled differently
 * - Upload response format differs between platforms
 * - Error handling patterns need adjustment
 *
 * Helper Utilities Created:
 * - FileUploadHelper.convertImagePickerResult() - Converts React Native image to Blob
 * - FileUploadHelper.generateFileName() - Consistent filename generation
 * - FileUploadHelper.getFileExtension() - Extract file extensions
 */
