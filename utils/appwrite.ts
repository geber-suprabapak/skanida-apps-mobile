import { Client, Account, Databases, Storage, ID } from "appwrite";

// Appwrite configuration
const appwriteConfig = {
  endpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT as string,
  projectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID as string,
  databaseId: process.env.EXPO_PUBLIC_APPWRITE_DATABASE_ID as string,
  // Collection IDs for migrated tables
  userProfilesCollectionId: process.env
    .EXPO_PUBLIC_APPWRITE_USER_PROFILES_COLLECTION_ID as string,
  absencesCollectionId: process.env
    .EXPO_PUBLIC_APPWRITE_ABSENCES_COLLECTION_ID as string,
  perizinanCollectionId: process.env
    .EXPO_PUBLIC_APPWRITE_PERIZINAN_COLLECTION_ID as string,
  // Storage bucket IDs
  attendancePhotosStorage: process.env
    .EXPO_PUBLIC_APPWRITE_ATTENDANCE_PHOTOS_STORAGE as string,
  perizinanStorage: process.env
    .EXPO_PUBLIC_APPWRITE_PERIZINAN_STORAGE as string,
  avatarsStorage: process.env.EXPO_PUBLIC_APPWRITE_AVATARS_STORAGE as string,
};

// Initialize Appwrite client
const client = new Client()
  .setEndpoint(appwriteConfig.endpoint)
  .setProject(appwriteConfig.projectId);

// Initialize Appwrite services
export const account = new Account(client);
export const databases = new Databases(client);
export const storage = new Storage(client);

// Export config and utilities
export { appwriteConfig, ID };
export default client;
