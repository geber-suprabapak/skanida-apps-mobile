# Known Issues & Solutions for Supabase to Appwrite Migration

## Overview

This document catalogues known issues, limitations, and potential problems that may arise during the migration from Supabase to Appwrite, along with their solutions and workarounds.

## Database Migration Issues

### Issue 1: Schema Differences
**Problem**: Appwrite uses NoSQL collections while Supabase uses PostgreSQL tables with foreign keys.

**Impact**: High - Affects data structure and relationships
**Likelihood**: Certain

**Solution**:
```typescript
// Original Supabase schema with foreign keys
// user_profiles.user_id → auth.users.id
// absences.user_id → auth.users.id

// Appwrite equivalent - embed relationships
interface UserProfile {
  $id: string;
  userId: string; // Store auth user ID as string
  fullName: string;
  email: string;
  absenceNumber: string;
  className: string;
  avatarUrl: string;
}

interface Absence {
  $id: string;
  userId: string; // Reference to auth user
  date: string;
  status: string;
  photoUrl?: string;
  latitude?: number;
  longitude?: number;
}
```

**Workaround**: Use document embedding and manual relationship management

### Issue 2: Date/Time Handling
**Problem**: Different date formats between PostgreSQL and Appwrite

**Impact**: Medium - Affects data integrity
**Likelihood**: High

**Solution**:
```typescript
// Standardize on ISO 8601 format
const convertSupabaseDate = (supabaseDate: string) => {
  return new Date(supabaseDate).toISOString();
};

// In migration scripts
const migrateAbsences = async () => {
  const supabaseData = await supabase
    .from('absences')
    .select('*');
  
  const appwriteData = supabaseData.data?.map(record => ({
    ...record,
    date: convertSupabaseDate(record.date),
    createdAt: convertSupabaseDate(record.created_at)
  }));
};
```

### Issue 3: Boolean Type Handling
**Problem**: Appwrite doesn't have native boolean type

**Impact**: Low - Minor data type adjustment
**Likelihood**: High

**Solution**:
```typescript
// Convert booleans to strings
const migratePerizinan = (data: any) => ({
  ...data,
  status: data.status ? 'true' : 'false',
});

// Helper functions for boolean handling
const toBool = (value: string): boolean => value === 'true';
const fromBool = (value: boolean): string => value.toString();
```

## Authentication Migration Issues

### Issue 4: User ID Format Changes
**Problem**: Supabase uses UUID format, Appwrite uses different ID format

**Impact**: High - Affects all user relationships
**Likelihood**: Certain

**Solution**:
```typescript
// Create user mapping table during migration
interface UserMapping {
  supabaseId: string;
  appwriteId: string;
  migrationDate: string;
}

// Migration strategy
const migrateUsers = async () => {
  const supabaseUsers = await supabase.auth.admin.listUsers();
  const mappings: UserMapping[] = [];
  
  for (const user of supabaseUsers.data.users) {
    // Create user in Appwrite
    const appwriteUser = await account.create(
      ID.unique(),
      user.email,
      'temporary-password'
    );
    
    mappings.push({
      supabaseId: user.id,
      appwriteId: appwriteUser.$id,
      migrationDate: new Date().toISOString()
    });
  }
  
  return mappings;
};
```

### Issue 5: Session Persistence Differences
**Problem**: Different session storage mechanisms

**Impact**: Medium - Affects user experience
**Likelihood**: High

**Solution**:
```typescript
// Create custom session manager
class SessionManager {
  private static STORAGE_KEY = 'appwrite_session';
  
  static async saveSession(session: Models.Session) {
    await AsyncStorage.setItem(
      this.STORAGE_KEY, 
      JSON.stringify(session)
    );
  }
  
  static async getSession(): Promise<Models.Session | null> {
    const session = await AsyncStorage.getItem(this.STORAGE_KEY);
    return session ? JSON.parse(session) : null;
  }
  
  static async clearSession() {
    await AsyncStorage.removeItem(this.STORAGE_KEY);
  }
}
```

### Issue 6: Password Migration
**Problem**: Cannot migrate existing passwords due to encryption differences

**Impact**: High - Users must reset passwords
**Likelihood**: Certain

**Solution**:
```typescript
// Force password reset for all users
const handlePasswordMigration = async () => {
  // 1. Create users with temporary passwords
  // 2. Send password reset emails
  // 3. Force password change on first login
  
  const resetPassword = async (email: string) => {
    await account.createRecovery(
      email,
      'https://yourapp.com/reset-password'
    );
  };
};
```

## Storage Migration Issues

### Issue 7: File URL Changes
**Problem**: All existing file URLs become invalid after migration

**Impact**: High - Breaks all file references
**Likelihood**: Certain

**Solution**:
```typescript
// Implement progressive file migration
class FileUrlMigrator {
  private supabasePattern = /supabase\.co\/storage/;
  private appwriteBaseUrl: string;
  
  constructor(appwriteEndpoint: string, projectId: string) {
    this.appwriteBaseUrl = `${appwriteEndpoint}/storage/buckets`;
  }
  
  async migrateFileUrl(oldUrl: string): Promise<string> {
    if (this.supabasePattern.test(oldUrl)) {
      // Extract file info and migrate
      const fileInfo = this.extractFileInfo(oldUrl);
      const newUrl = await this.uploadToAppwrite(fileInfo);
      return newUrl;
    }
    return oldUrl;
  }
  
  private async uploadToAppwrite(fileInfo: any) {
    // Download from Supabase and upload to Appwrite
    const response = await fetch(fileInfo.url);
    const blob = await response.blob();
    
    const file = await storage.createFile(
      fileInfo.bucketId,
      ID.unique(),
      blob
    );
    
    return storage.getFileView(fileInfo.bucketId, file.$id);
  }
}
```

### Issue 8: File Permissions
**Problem**: Different permission models between platforms

**Impact**: Medium - Affects file access control
**Likelihood**: High

**Solution**:
```typescript
// Standardize file permissions
const setAppwritePermissions = async (bucketId: string) => {
  await storage.updateBucket(
    bucketId,
    bucketId,
    [Permission.read(Role.any())], // Read permissions
    [Permission.write(Role.users())], // Write permissions
    true, // Enabled
    undefined, // Maximum file size
    ['jpg', 'png', 'pdf', 'doc'] // Allowed file extensions
  );
};
```

## Real-time Features Issues

### Issue 9: Real-time API Differences
**Problem**: Different real-time subscription APIs

**Impact**: Medium - Affects live updates
**Likelihood**: Medium (if using real-time features)

**Solution**:
```typescript
// Abstraction layer for real-time updates
interface RealtimeManager {
  subscribe(collection: string, callback: Function): void;
  unsubscribe(subscriptionId: string): void;
}

class AppwriteRealtimeManager implements RealtimeManager {
  private client: Client;
  
  subscribe(collection: string, callback: Function) {
    return this.client.subscribe(
      `databases.${DATABASE_ID}.collections.${collection}.documents`,
      callback
    );
  }
  
  unsubscribe(subscriptionId: string) {
    this.client.unsubscribe(subscriptionId);
  }
}
```

## Performance Issues

### Issue 10: Query Performance Differences
**Problem**: NoSQL queries may perform differently than SQL

**Impact**: Medium - Affects app responsiveness
**Likelihood**: Medium

**Solution**:
```typescript
// Optimize Appwrite queries
const optimizeQueries = {
  // Use indexes for frequently queried fields
  createIndexes: async () => {
    await databases.createIndex(
      DATABASE_ID,
      'absences',
      'user_date_idx',
      'key',
      ['userId', 'date'],
      ['desc', 'desc']
    );
  },
  
  // Implement query optimization
  getRecentAbsences: async (userId: string, limit = 10) => {
    return await databases.listDocuments(
      DATABASE_ID,
      'absences',
      [
        Query.equal('userId', userId),
        Query.orderDesc('createdAt'),
        Query.limit(limit)
      ]
    );
  }
};
```

### Issue 11: File Upload Size Limits
**Problem**: Different file size limitations

**Impact**: Medium - May affect large file uploads
**Likelihood**: Medium

**Solution**:
```typescript
// Implement file compression before upload
const compressAndUpload = async (file: any) => {
  const maxSize = 5 * 1024 * 1024; // 5MB limit
  
  if (file.size > maxSize) {
    // Compress image using expo-image-manipulator
    const compressed = await ImageManipulator.manipulateAsync(
      file.uri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    return compressed;
  }
  
  return file;
};
```

## Mobile App Specific Issues

### Issue 12: SDK Differences
**Problem**: Different API patterns between Supabase and Appwrite SDKs

**Impact**: High - Requires code changes throughout app
**Likelihood**: Certain

**Solution**:
```typescript
// Create abstraction layer to minimize code changes
interface BackendService {
  auth: AuthService;
  database: DatabaseService;
  storage: StorageService;
}

class AppwriteBackendService implements BackendService {
  auth = new AppwriteAuthService();
  database = new AppwriteDatabaseService();
  storage = new AppwriteStorageService();
}

// Gradual migration approach
const useBackend = () => {
  const isAppwriteMigration = process.env.EXPO_PUBLIC_USE_APPWRITE === 'true';
  
  return isAppwriteMigration 
    ? new AppwriteBackendService()
    : new SupabaseBackendService();
};
```

### Issue 13: Error Handling Changes
**Problem**: Different error formats and codes

**Impact**: Medium - Affects error handling throughout app
**Likelihood**: High

**Solution**:
```typescript
// Standardize error handling
class ErrorHandler {
  static normalize(error: any): AppError {
    if (error.type && error.type.startsWith('appwrite')) {
      return {
        code: error.code,
        message: error.message,
        type: 'appwrite'
      };
    }
    
    // Handle Supabase errors
    return {
      code: error.status,
      message: error.message,
      type: 'supabase'
    };
  }
}
```

## Deployment Issues

### Issue 14: Environment Configuration
**Problem**: Different environment variables and configuration

**Impact**: Medium - Affects deployment process
**Likelihood**: High

**Solution**:
```bash
# Add new environment variables
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your-project-id
EXPO_PUBLIC_DATABASE_ID=your-database-id
EXPO_PUBLIC_MIGRATION_MODE=true # For gradual migration

# Keep Supabase variables during transition
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-key
```

### Issue 15: Build Process Changes
**Problem**: Different dependencies and build configurations

**Impact**: Low - Minor build script updates
**Likelihood**: High

**Solution**:
```json
// Update package.json
{
  "dependencies": {
    "appwrite": "^13.0.0",
    "@supabase/supabase-js": "2.49.5-next.5" // Keep during transition
  },
  "scripts": {
    "prebuild:migration": "expo prebuild --clear && expo install",
    "test:migration": "jest --config=jest.migration.config.js"
  }
}
```

## Mitigation Strategies

### Gradual Migration Approach
```typescript
// Feature flag system for gradual migration
const FeatureFlags = {
  USE_APPWRITE_AUTH: false,
  USE_APPWRITE_DATABASE: false,
  USE_APPWRITE_STORAGE: false,
};

const getAuthService = () => {
  return FeatureFlags.USE_APPWRITE_AUTH 
    ? new AppwriteAuthService() 
    : new SupabaseAuthService();
};
```

### Rollback Procedures
```typescript
// Quick rollback mechanism
const rollbackMigration = async () => {
  // 1. Update feature flags
  await updateFeatureFlags({
    USE_APPWRITE_AUTH: false,
    USE_APPWRITE_DATABASE: false,
    USE_APPWRITE_STORAGE: false,
  });
  
  // 2. Clear Appwrite sessions
  await AsyncStorage.removeItem('appwrite_session');
  
  // 3. Restore Supabase session
  await restoreSupabaseSession();
  
  // 4. Update app configuration
  await updateAppConfig('supabase');
};
```

## Monitoring & Alerting

### Critical Metrics to Monitor
- Authentication success rate
- Database query response times
- File upload success rate
- Error rates by operation type
- User session duration

### Alert Thresholds
- Authentication failure rate > 5%
- Database response time > 3 seconds
- File upload failure rate > 10%
- Any 5xx errors from Appwrite
- Memory usage > 80%

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Next Review**: Weekly during migration phases