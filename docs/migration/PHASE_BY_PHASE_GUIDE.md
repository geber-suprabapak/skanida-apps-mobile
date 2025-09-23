# Phase-by-Phase Migration Guide

## Overview

This document provides detailed implementation steps for each phase of the Supabase to Appwrite migration. Each phase includes specific tasks, code examples, and validation criteria.

## Phase 1: Infrastructure Setup (Week 1-2)

### Objective
Establish Appwrite infrastructure and prepare development environment for migration.

### Prerequisites
- [ ] Appwrite account created (Cloud or self-hosted)
- [ ] Development team access configured
- [ ] Budget and resource allocation approved

### Step 1.1: Appwrite Project Setup

#### Create Appwrite Project
1. **Login to Appwrite Console**
   - Navigate to [Appwrite Cloud Console](https://cloud.appwrite.io)
   - Create new project: "skanida-apps-mobile"

2. **Configure Project Settings**
   ```json
   {
     "name": "Skanida Apps Mobile",
     "projectId": "skanida-mobile-prod",
     "region": "asia-southeast1",
     "plan": "pro"
   }
   ```

3. **Set Up Platforms**
   ```bash
   # Android
   Package Name: com.skanida.mobile
   SHA-256: [Your app signing certificate fingerprint]
   
   # iOS
   Bundle ID: com.skanida.mobile
   Team ID: [Your Apple Developer Team ID]
   ```

### Step 1.2: Database Configuration

#### Create Database
```bash
# Using Appwrite CLI
appwrite databases create \
  --databaseId="main" \
  --name="Skanida Database"
```

#### Create Collections
```typescript
// scripts/setup-database.ts
import { Client, Databases, Permission, Role } from 'appwrite';

const client = new Client()
  .setEndpoint('https://cloud.appwrite.io/v1')
  .setProject('skanida-mobile-prod')
  .setKey('your-api-key');

const databases = new Databases(client);

const setupCollections = async () => {
  // User Profiles Collection
  await databases.createCollection(
    'main',
    'user_profiles',
    'User Profiles',
    [Permission.read(Role.users())],
    [Permission.write(Role.users())]
  );

  // Absences Collection
  await databases.createCollection(
    'main',
    'absences',
    'Absences',
    [Permission.read(Role.users())],
    [Permission.write(Role.users())]
  );

  // Perizinan Collection
  await databases.createCollection(
    'main',
    'perizinan',
    'Leave Requests',
    [Permission.read(Role.users())],
    [Permission.write(Role.users())]
  );
};
```

#### Define Attributes
```typescript
// Create attributes for user_profiles
const createUserProfileAttributes = async () => {
  const collection = 'user_profiles';
  
  await databases.createStringAttribute('main', collection, 'userId', 255, true);
  await databases.createStringAttribute('main', collection, 'fullName', 255, false);
  await databases.createEmailAttribute('main', collection, 'email', true);
  await databases.createStringAttribute('main', collection, 'absenceNumber', 50, false);
  await databases.createStringAttribute('main', collection, 'className', 100, false);
  await databases.createUrlAttribute('main', collection, 'avatarUrl', false);
  await databases.createStringAttribute('main', collection, 'role', 50, false);
};

// Create attributes for absences
const createAbsenceAttributes = async () => {
  const collection = 'absences';
  
  await databases.createStringAttribute('main', collection, 'userId', 255, true);
  await databases.createDatetimeAttribute('main', collection, 'date', true);
  await databases.createEnumAttribute(
    'main', collection, 'status', 
    ['Hadir', 'Datang', 'Pulang'], true
  );
  await databases.createStringAttribute('main', collection, 'reason', 500, false);
  await databases.createUrlAttribute('main', collection, 'photoUrl', false);
  await databases.createFloatAttribute('main', collection, 'latitude', false);
  await databases.createFloatAttribute('main', collection, 'longitude', false);
};
```

### Step 1.3: Storage Configuration

#### Create Storage Buckets
```typescript
const setupStorage = async () => {
  const storage = new Storage(client);
  
  // Avatars bucket
  await storage.createBucket(
    'avatars',
    'User Avatars',
    [Permission.read(Role.any())],
    [Permission.write(Role.users())],
    true, // enabled
    10485760, // 10MB max file size
    ['jpg', 'jpeg', 'png', 'webp']
  );
  
  // Attendance photos bucket
  await storage.createBucket(
    'attendance-photos',
    'Attendance Photos',
    [Permission.read(Role.users())],
    [Permission.write(Role.users())],
    true,
    52428800, // 50MB
    ['jpg', 'jpeg', 'png']
  );
  
  // Perizinan documents bucket
  await storage.createBucket(
    'perizinan',
    'Leave Request Documents',
    [Permission.read(Role.users())],
    [Permission.write(Role.users())],
    true,
    104857600, // 100MB
    ['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png']
  );
};
```

### Step 1.4: Development Environment

#### Install Dependencies
```bash
cd /home/runner/work/skanida-apps-mobile/skanida-apps-mobile
pnpm add appwrite
pnpm add -D @types/jest jest-expo
```

#### Update Environment Configuration
```typescript
// app.config.ts
export default {
  expo: {
    name: "Skanida Apps Mobile",
    slug: "skanida-apps-mobile",
    extra: {
      // Existing Supabase config (keep during transition)
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      
      // New Appwrite config
      appwriteEndpoint: process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT,
      appwriteProjectId: process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID,
      databaseId: process.env.EXPO_PUBLIC_DATABASE_ID,
      
      // Migration flags
      migrationPhase: process.env.EXPO_PUBLIC_MIGRATION_PHASE || "1",
      useAppwrite: process.env.EXPO_PUBLIC_USE_APPWRITE === "true",
    }
  }
};
```

### Step 1.5: Testing Infrastructure

#### Create Test Database
```typescript
// Setup test environment
const setupTestEnvironment = async () => {
  const testClient = new Client()
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('skanida-mobile-test')
    .setKey('test-api-key');
    
  // Create test collections with same structure
  await setupCollections();
  await setupStorage();
  
  // Populate with test data
  await seedTestData();
};
```

### Validation Criteria
- [ ] Appwrite project created and accessible
- [ ] All collections created with proper attributes
- [ ] Storage buckets configured with correct permissions
- [ ] Development environment connecting successfully
- [ ] Test environment ready for migration testing

---

## Phase 2: Database Migration (Week 3-4)

### Objective
Migrate all data from Supabase PostgreSQL to Appwrite NoSQL collections.

### Step 2.1: Data Analysis

#### Analyze Current Data
```bash
# Connect to Supabase and analyze data
psql "postgresql://postgres:[password]@[host]:5432/postgres"

-- Get table counts
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes
FROM pg_stat_user_tables;

-- Analyze data types and constraints
\d+ user_profiles
\d+ absences
\d+ perizinan
```

#### Create Data Mapping
```typescript
// scripts/data-mapping.ts
interface DataMapping {
  supabaseTable: string;
  appwriteCollection: string;
  fieldMappings: Record<string, string>;
  transformations: Record<string, (value: any) => any>;
}

const userProfileMapping: DataMapping = {
  supabaseTable: 'user_profiles',
  appwriteCollection: 'user_profiles',
  fieldMappings: {
    'id': '$id',
    'user_id': 'userId',
    'full_name': 'fullName',
    'email': 'email',
    'absence_number': 'absenceNumber',
    'class_name': 'className',
    'avatar_url': 'avatarUrl',
    'role': 'role',
    'created_at': '$createdAt',
    'updated_at': '$updatedAt'
  },
  transformations: {
    'created_at': (value) => new Date(value).toISOString(),
    'updated_at': (value) => new Date(value).toISOString()
  }
};
```

### Step 2.2: Migration Scripts

#### Create Base Migration Class
```typescript
// scripts/migration/BaseMigrator.ts
export abstract class BaseMigrator {
  protected supabase: SupabaseClient;
  protected databases: Databases;
  protected batchSize = 100;
  
  constructor(supabase: SupabaseClient, databases: Databases) {
    this.supabase = supabase;
    this.databases = databases;
  }
  
  abstract migrate(): Promise<void>;
  
  protected async migrateInBatches<T>(
    data: T[],
    processor: (batch: T[]) => Promise<void>
  ) {
    for (let i = 0; i < data.length; i += this.batchSize) {
      const batch = data.slice(i, i + this.batchSize);
      await processor(batch);
      console.log(`Processed ${i + batch.length}/${data.length} records`);
    }
  }
  
  protected logProgress(operation: string, current: number, total: number) {
    console.log(`${operation}: ${current}/${total} (${Math.round(current/total*100)}%)`);
  }
}
```

#### User Profiles Migration
```typescript
// scripts/migration/UserProfileMigrator.ts
export class UserProfileMigrator extends BaseMigrator {
  async migrate(): Promise<void> {
    console.log('Starting user profiles migration...');
    
    // Fetch all user profiles from Supabase
    const { data: profiles, error } = await this.supabase
      .from('user_profiles')
      .select('*')
      .order('created_at');
      
    if (error) throw error;
    
    console.log(`Found ${profiles.length} user profiles to migrate`);
    
    await this.migrateInBatches(profiles, async (batch) => {
      const promises = batch.map(profile => this.migrateProfile(profile));
      await Promise.all(promises);
    });
    
    console.log('User profiles migration completed');
  }
  
  private async migrateProfile(profile: any) {
    try {
      const appwriteDoc = {
        userId: profile.user_id,
        fullName: profile.full_name,
        email: profile.email,
        absenceNumber: profile.absence_number,
        className: profile.class_name,
        avatarUrl: profile.avatar_url,
        role: profile.role
      };
      
      await this.databases.createDocument(
        'main',
        'user_profiles',
        profile.id, // Use same ID
        appwriteDoc
      );
      
    } catch (error) {
      console.error(`Failed to migrate profile ${profile.id}:`, error);
      throw error;
    }
  }
}
```

#### Absences Migration
```typescript
// scripts/migration/AbsenceMigrator.ts
export class AbsenceMigrator extends BaseMigrator {
  async migrate(): Promise<void> {
    console.log('Starting absences migration...');
    
    // Get total count for progress tracking
    const { count } = await this.supabase
      .from('absences')
      .select('*', { count: 'exact', head: true });
    
    let offset = 0;
    const limit = this.batchSize;
    
    while (offset < count) {
      const { data: absences, error } = await this.supabase
        .from('absences')
        .select('*')
        .order('created_at')
        .range(offset, offset + limit - 1);
        
      if (error) throw error;
      
      await this.migrateAbsencesBatch(absences);
      
      offset += limit;
      this.logProgress('Absences migration', offset, count);
    }
    
    console.log('Absences migration completed');
  }
  
  private async migrateAbsencesBatch(absences: any[]) {
    const promises = absences.map(async (absence) => {
      const appwriteDoc = {
        userId: absence.user_id,
        date: new Date(absence.date).toISOString(),
        status: absence.status,
        reason: absence.reason,
        photoUrl: absence.photo_url,
        latitude: absence.latitude,
        longitude: absence.longitude
      };
      
      return this.databases.createDocument(
        'main',
        'absences',
        absence.id,
        appwriteDoc
      );
    });
    
    await Promise.all(promises);
  }
}
```

### Step 2.3: Data Validation

#### Create Validation Scripts
```typescript
// scripts/validation/DataValidator.ts
export class DataValidator {
  private supabase: SupabaseClient;
  private databases: Databases;
  
  constructor(supabase: SupabaseClient, databases: Databases) {
    this.supabase = supabase;
    this.databases = databases;
  }
  
  async validateMigration(): Promise<ValidationReport> {
    const report: ValidationReport = {
      userProfiles: await this.validateUserProfiles(),
      absences: await this.validateAbsences(),
      perizinan: await this.validatePerizinan(),
      summary: {
        totalErrors: 0,
        totalWarnings: 0,
        success: true
      }
    };
    
    report.summary.totalErrors = 
      report.userProfiles.errors.length +
      report.absences.errors.length +
      report.perizinan.errors.length;
      
    report.summary.success = report.summary.totalErrors === 0;
    
    return report;
  }
  
  private async validateUserProfiles(): Promise<CollectionValidation> {
    const supabaseCount = await this.getSupabaseCount('user_profiles');
    const appwriteCount = await this.getAppwriteCount('user_profiles');
    
    const validation: CollectionValidation = {
      collection: 'user_profiles',
      supabaseCount,
      appwriteCount,
      errors: [],
      warnings: []
    };
    
    if (supabaseCount !== appwriteCount) {
      validation.errors.push({
        type: 'count_mismatch',
        message: `Count mismatch: Supabase=${supabaseCount}, Appwrite=${appwriteCount}`
      });
    }
    
    // Sample validation of random records
    await this.validateSampleRecords('user_profiles', validation);
    
    return validation;
  }
}
```

### Step 2.4: Incremental Sync

#### Real-time Sync During Migration
```typescript
// scripts/sync/IncrementalSync.ts
export class IncrementalSync {
  private lastSyncTimestamp: string;
  
  constructor() {
    this.lastSyncTimestamp = new Date().toISOString();
  }
  
  async startSync(): Promise<void> {
    setInterval(async () => {
      await this.syncChanges();
    }, 30000); // Sync every 30 seconds
  }
  
  private async syncChanges(): Promise<void> {
    try {
      // Sync new/updated user profiles
      await this.syncUserProfileChanges();
      
      // Sync new/updated absences
      await this.syncAbsenceChanges();
      
      // Sync new/updated perizinan
      await this.syncPerizinanChanges();
      
      this.lastSyncTimestamp = new Date().toISOString();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }
  
  private async syncUserProfileChanges(): Promise<void> {
    const { data: changes } = await this.supabase
      .from('user_profiles')
      .select('*')
      .gte('updated_at', this.lastSyncTimestamp);
      
    for (const profile of changes || []) {
      await this.upsertUserProfile(profile);
    }
  }
}
```

### Validation Criteria
- [ ] All user profiles migrated correctly (count match)
- [ ] All absences migrated with proper data types
- [ ] All perizinan records transferred successfully
- [ ] Data integrity checks pass
- [ ] Performance within acceptable limits
- [ ] Incremental sync working properly

---

## Phase 3: Authentication Migration (Week 5-6)

### Objective
Migrate user authentication from Supabase Auth to Appwrite Auth while maintaining user sessions.

### Step 3.1: Appwrite Auth Configuration

#### Configure Authentication Methods
```typescript
// Configure email/password authentication
const setupAuth = async () => {
  // Enable email/password provider (done via console)
  // Configure password policy
  const passwordPolicy = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
    requireSymbols: false
  };
  
  // Configure session settings
  const sessionConfig = {
    duration: 7 * 24 * 60 * 60, // 7 days
    autoRefresh: true
  };
};
```

### Step 3.2: User Migration Strategy

#### Extract User Data from Supabase
```typescript
// scripts/auth-migration/UserExtractor.ts
export class UserExtractor {
  private supabase: SupabaseClient;
  
  constructor(supabase: SupabaseClient) {
    this.supabase = supabase;
  }
  
  async extractUsers(): Promise<UserData[]> {
    const users: UserData[] = [];
    let page = 1;
    const perPage = 1000;
    
    while (true) {
      const { data, error } = await this.supabase.auth.admin.listUsers({
        page,
        perPage
      });
      
      if (error) throw error;
      
      if (data.users.length === 0) break;
      
      for (const user of data.users) {
        users.push({
          id: user.id,
          email: user.email!,
          emailConfirmed: user.email_confirmed_at !== null,
          createdAt: user.created_at,
          lastSignIn: user.last_sign_in_at,
          metadata: user.user_metadata
        });
      }
      
      page++;
    }
    
    return users;
  }
}
```

#### Create Users in Appwrite
```typescript
// scripts/auth-migration/UserCreator.ts
export class UserCreator {
  private users: Users;
  
  constructor(users: Users) {
    this.users = users;
  }
  
  async createUsers(userData: UserData[]): Promise<UserMapping[]> {
    const mappings: UserMapping[] = [];
    
    for (const user of userData) {
      try {
        // Create user with temporary password
        const appwriteUser = await this.users.create(
          ID.unique(),
          user.email,
          undefined, // phone
          this.generateTempPassword(),
          user.metadata?.full_name || user.email.split('@')[0]
        );
        
        mappings.push({
          supabaseId: user.id,
          appwriteId: appwriteUser.$id,
          email: user.email,
          migrationDate: new Date().toISOString()
        });
        
        // Send password reset email
        await this.account.createRecovery(
          user.email,
          'https://yourapp.com/reset-password'
        );
        
      } catch (error) {
        console.error(`Failed to create user ${user.email}:`, error);
      }
    }
    
    return mappings;
  }
  
  private generateTempPassword(): string {
    return Math.random().toString(36).slice(-12) + 'A1!';
  }
}
```

### Step 3.3: Dual Authentication Support

#### Create Authentication Abstraction
```typescript
// utils/auth/AuthProvider.ts
export interface AuthProvider {
  login(email: string, password: string): Promise<User>;
  register(email: string, password: string): Promise<User>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  resetPassword(email: string): Promise<void>;
}

export class DualAuthProvider implements AuthProvider {
  private useAppwrite: boolean;
  private supabaseAuth: SupabaseAuthProvider;
  private appwriteAuth: AppwriteAuthProvider;
  
  constructor() {
    this.useAppwrite = process.env.EXPO_PUBLIC_USE_APPWRITE_AUTH === 'true';
    this.supabaseAuth = new SupabaseAuthProvider();
    this.appwriteAuth = new AppwriteAuthProvider();
  }
  
  async login(email: string, password: string): Promise<User> {
    if (this.useAppwrite) {
      try {
        return await this.appwriteAuth.login(email, password);
      } catch (error) {
        // Fallback to Supabase if Appwrite fails
        console.warn('Appwrite login failed, falling back to Supabase');
        return await this.supabaseAuth.login(email, password);
      }
    }
    
    return await this.supabaseAuth.login(email, password);
  }
  
  // Implement other methods similarly
}
```

#### Update Auth Store
```typescript
// store/authStore.ts - Updated version
import { create } from 'zustand';
import { DualAuthProvider } from '~/utils/auth/AuthProvider';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  authProvider: 'supabase' | 'appwrite' | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  authProvider: null,
  
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const authProvider = new DualAuthProvider();
      const user = await authProvider.login(email, password);
      
      set({ 
        user, 
        isLoading: false,
        authProvider: process.env.EXPO_PUBLIC_USE_APPWRITE_AUTH === 'true' ? 'appwrite' : 'supabase'
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  checkAuth: async () => {
    try {
      const authProvider = new DualAuthProvider();
      const user = await authProvider.getCurrentUser();
      
      set({ 
        user,
        authProvider: user ? (process.env.EXPO_PUBLIC_USE_APPWRITE_AUTH === 'true' ? 'appwrite' : 'supabase') : null
      });
    } catch (error) {
      set({ user: null, authProvider: null });
    }
  }
}));
```

### Step 3.4: Migration Testing

#### Auth Migration Tests
```typescript
// __tests__/auth-migration.test.ts
describe('Auth Migration', () => {
  it('should migrate user successfully', async () => {
    const testUser = {
      email: 'test@example.com',
      password: 'TestPassword123!'
    };
    
    // Create in Supabase first
    const supabaseUser = await supabaseAuth.register(
      testUser.email, 
      testUser.password
    );
    
    // Migrate to Appwrite
    const migrator = new UserMigrator();
    const mapping = await migrator.migrateUser(supabaseUser);
    
    expect(mapping.appwriteId).toBeDefined();
    expect(mapping.email).toBe(testUser.email);
    
    // Test login with Appwrite
    const appwriteUser = await appwriteAuth.login(
      testUser.email,
      'new-password-after-reset'
    );
    
    expect(appwriteUser).toBeDefined();
  });
});
```

### Validation Criteria
- [ ] All users migrated to Appwrite Auth
- [ ] User mapping table created and populated
- [ ] Password reset emails sent to all users
- [ ] Dual authentication working correctly
- [ ] Session persistence maintained
- [ ] Fallback mechanism functioning

---

## Phase 4: Storage Migration (Week 7-8)

### Objective
Migrate all files from Supabase Storage to Appwrite Storage while maintaining accessibility.

### Step 4.1: File Inventory

#### Analyze Current Storage Usage
```typescript
// scripts/storage-analysis/StorageAnalyzer.ts
export class StorageAnalyzer {
  private supabase: SupabaseClient;
  
  async analyzeStorage(): Promise<StorageReport> {
    const buckets = ['avatars', 'attendance-photos', 'perizinan'];
    const report: StorageReport = {
      buckets: [],
      totalFiles: 0,
      totalSize: 0
    };
    
    for (const bucketName of buckets) {
      const bucketReport = await this.analyzeBucket(bucketName);
      report.buckets.push(bucketReport);
      report.totalFiles += bucketReport.fileCount;
      report.totalSize += bucketReport.totalSize;
    }
    
    return report;
  }
  
  private async analyzeBucket(bucketName: string): Promise<BucketReport> {
    const { data: files, error } = await this.supabase.storage
      .from(bucketName)
      .list();
      
    if (error) throw error;
    
    return {
      name: bucketName,
      fileCount: files.length,
      totalSize: files.reduce((sum, file) => sum + (file.metadata?.size || 0), 0),
      fileTypes: this.categorizeFileTypes(files)
    };
  }
}
```

### Step 4.2: Progressive File Migration

#### File Migration Strategy
```typescript
// scripts/storage-migration/FileMigrator.ts
export class FileMigrator {
  private supabase: SupabaseClient;
  private storage: Storage;
  private migrationLog: MigrationLog;
  
  constructor(supabase: SupabaseClient, storage: Storage) {
    this.supabase = supabase;
    this.storage = storage;
    this.migrationLog = new MigrationLog();
  }
  
  async migrateAllFiles(): Promise<void> {
    const buckets = ['avatars', 'attendance-photos', 'perizinan'];
    
    for (const bucketName of buckets) {
      await this.migrateBucket(bucketName);
    }
  }
  
  private async migrateBucket(bucketName: string): Promise<void> {
    console.log(`Starting migration of bucket: ${bucketName}`);
    
    const { data: files, error } = await this.supabase.storage
      .from(bucketName)
      .list('', { limit: 1000 });
      
    if (error) throw error;
    
    for (const file of files) {
      await this.migrateFile(bucketName, file);
    }
    
    console.log(`Completed migration of bucket: ${bucketName}`);
  }
  
  private async migrateFile(bucketName: string, file: FileObject): Promise<void> {
    try {
      // Download from Supabase
      const { data: fileData, error: downloadError } = await this.supabase.storage
        .from(bucketName)
        .download(file.name);
        
      if (downloadError) throw downloadError;
      
      // Upload to Appwrite
      const appwriteFile = await this.storage.createFile(
        bucketName,
        file.name, // Keep same filename for easier mapping
        fileData
      );
      
      // Log successful migration
      await this.migrationLog.logSuccess(bucketName, file.name, appwriteFile.$id);
      
    } catch (error) {
      console.error(`Failed to migrate file ${bucketName}/${file.name}:`, error);
      await this.migrationLog.logError(bucketName, file.name, error);
    }
  }
}
```

### Step 4.3: URL Migration

#### Update File URLs in Database
```typescript
// scripts/storage-migration/UrlUpdater.ts
export class UrlUpdater {
  private databases: Databases;
  private urlMappings: Map<string, string>;
  
  constructor(databases: Databases) {
    this.databases = databases;
    this.urlMappings = new Map();
  }
  
  async updateAllUrls(): Promise<void> {
    // Load URL mappings from migration log
    await this.loadUrlMappings();
    
    // Update user profile avatar URLs
    await this.updateUserProfileUrls();
    
    // Update absence photo URLs
    await this.updateAbsencePhotoUrls();
    
    // Update perizinan document URLs
    await this.updatePerizinanUrls();
  }
  
  private async updateUserProfileUrls(): Promise<void> {
    const { documents: profiles } = await this.databases.listDocuments(
      'main',
      'user_profiles',
      [Query.isNotNull('avatarUrl')]
    );
    
    for (const profile of profiles) {
      const newUrl = this.convertUrl(profile.avatarUrl);
      if (newUrl !== profile.avatarUrl) {
        await this.databases.updateDocument(
          'main',
          'user_profiles',
          profile.$id,
          { avatarUrl: newUrl }
        );
      }
    }
  }
  
  private convertUrl(oldUrl: string): string {
    // Convert Supabase URL to Appwrite URL
    const supabasePattern = /https:\/\/[^\/]+\.supabase\.co\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/;
    const match = oldUrl.match(supabasePattern);
    
    if (match) {
      const [, bucketName, fileName] = match;
      const fileId = this.urlMappings.get(`${bucketName}/${fileName}`);
      
      if (fileId) {
        return this.storage.getFileView(bucketName, fileId).href;
      }
    }
    
    return oldUrl; // Return original if no mapping found
  }
}
```

### Step 4.4: Progressive Migration with Fallback

#### Smart URL Resolution
```typescript
// utils/storage/SmartStorageProvider.ts
export class SmartStorageProvider {
  private storage: Storage;
  private supabase: SupabaseClient;
  
  constructor(storage: Storage, supabase: SupabaseClient) {
    this.storage = storage;
    this.supabase = supabase;
  }
  
  async getFileUrl(url: string): Promise<string> {
    // If already an Appwrite URL, return as-is
    if (url.includes('appwrite')) {
      return url;
    }
    
    // If Supabase URL, try to resolve to Appwrite
    const appwriteUrl = await this.tryAppwriteUrl(url);
    if (appwriteUrl) {
      return appwriteUrl;
    }
    
    // Fallback to original Supabase URL
    return url;
  }
  
  private async tryAppwriteUrl(supabaseUrl: string): Promise<string | null> {
    try {
      // Extract bucket and file info from Supabase URL
      const { bucketName, fileName } = this.parseSupabaseUrl(supabaseUrl);
      
      // Try to get file from Appwrite
      const fileId = await this.findAppwriteFileId(bucketName, fileName);
      if (fileId) {
        return this.storage.getFileView(bucketName, fileId).href;
      }
    } catch (error) {
      console.warn('Failed to resolve Appwrite URL:', error);
    }
    
    return null;
  }
}
```

### Validation Criteria
- [ ] All files migrated successfully
- [ ] File integrity verified (checksums)
- [ ] Database URLs updated correctly
- [ ] Progressive loading working
- [ ] Fallback mechanism functional
- [ ] Performance within acceptable limits

---

## Phase 5: API Integration (Week 9-10)

### Objective
Replace all Supabase API calls with Appwrite SDK throughout the mobile application.

### Step 5.1: Create Appwrite Service Layer

#### Base Service Implementation
```typescript
// services/AppwriteService.ts
export class AppwriteService {
  protected client: Client;
  protected account: Account;
  protected databases: Databases;
  protected storage: Storage;
  
  constructor() {
    this.client = new Client()
      .setEndpoint(process.env.EXPO_PUBLIC_APPWRITE_ENDPOINT!)
      .setProject(process.env.EXPO_PUBLIC_APPWRITE_PROJECT_ID!);
      
    this.account = new Account(this.client);
    this.databases = new Databases(this.client);
    this.storage = new Storage(this.client);
  }
  
  protected handleError(error: any): never {
    const appError = this.normalizeError(error);
    throw appError;
  }
  
  private normalizeError(error: any): AppError {
    return {
      code: error.code || 500,
      message: error.message || 'An error occurred',
      type: error.type || 'appwrite'
    };
  }
}
```

#### Authentication Service
```typescript
// services/AuthService.ts
export class AuthService extends AppwriteService {
  async login(email: string, password: string): Promise<Models.User<Models.Preferences>> {
    try {
      await this.account.createEmailSession(email, password);
      return await this.account.get();
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async register(email: string, password: string, name?: string): Promise<Models.User<Models.Preferences>> {
    try {
      const user = await this.account.create(
        ID.unique(),
        email,
        password,
        name
      );
      
      // Auto-login after registration
      await this.account.createEmailSession(email, password);
      return await this.account.get();
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async logout(): Promise<void> {
    try {
      await this.account.deleteSession('current');
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async getCurrentUser(): Promise<Models.User<Models.Preferences> | null> {
    try {
      return await this.account.get();
    } catch (error) {
      return null;
    }
  }
  
  async updateProfile(data: Partial<UserProfileUpdate>): Promise<Models.User<Models.Preferences>> {
    try {
      return await this.account.updateName(data.name || '');
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    try {
      await this.account.updatePassword(newPassword, oldPassword);
    } catch (error) {
      this.handleError(error);
    }
  }
}
```

#### Database Service
```typescript
// services/DatabaseService.ts
export class DatabaseService extends AppwriteService {
  private readonly databaseId = process.env.EXPO_PUBLIC_DATABASE_ID!;
  
  // User Profiles
  async getUserProfile(userId: string): Promise<UserProfile> {
    try {
      const { documents } = await this.databases.listDocuments(
        this.databaseId,
        'user_profiles',
        [Query.equal('userId', userId)]
      );
      
      if (documents.length === 0) {
        throw new Error('User profile not found');
      }
      
      return documents[0] as UserProfile;
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async createUserProfile(profile: CreateUserProfile): Promise<UserProfile> {
    try {
      return await this.databases.createDocument(
        this.databaseId,
        'user_profiles',
        ID.unique(),
        profile
      ) as UserProfile;
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async updateUserProfile(profileId: string, updates: Partial<UserProfile>): Promise<UserProfile> {
    try {
      return await this.databases.updateDocument(
        this.databaseId,
        'user_profiles',
        profileId,
        updates
      ) as UserProfile;
    } catch (error) {
      this.handleError(error);
    }
  }
  
  // Absences
  async getAbsences(userId: string, limit = 50): Promise<Absence[]> {
    try {
      const { documents } = await this.databases.listDocuments(
        this.databaseId,
        'absences',
        [
          Query.equal('userId', userId),
          Query.orderDesc('date'),
          Query.limit(limit)
        ]
      );
      
      return documents as Absence[];
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async createAbsence(absence: CreateAbsence): Promise<Absence> {
    try {
      return await this.databases.createDocument(
        this.databaseId,
        'absences',
        ID.unique(),
        absence
      ) as Absence;
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async getMonthlyAbsences(userId: string, year: number, month: number): Promise<Absence[]> {
    try {
      const startDate = new Date(year, month - 1, 1).toISOString();
      const endDate = new Date(year, month, 0, 23, 59, 59).toISOString();
      
      const { documents } = await this.databases.listDocuments(
        this.databaseId,
        'absences',
        [
          Query.equal('userId', userId),
          Query.greaterThanEqual('date', startDate),
          Query.lessThanEqual('date', endDate),
          Query.orderDesc('date')
        ]
      );
      
      return documents as Absence[];
    } catch (error) {
      this.handleError(error);
    }
  }
  
  // Perizinan (Leave Requests)
  async getLeaveRequests(userId: string): Promise<LeaveRequest[]> {
    try {
      const { documents } = await this.databases.listDocuments(
        this.databaseId,
        'perizinan',
        [
          Query.equal('userId', userId),
          Query.orderDesc('tanggal')
        ]
      );
      
      return documents as LeaveRequest[];
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async createLeaveRequest(request: CreateLeaveRequest): Promise<LeaveRequest> {
    try {
      return await this.databases.createDocument(
        this.databaseId,
        'perizinan',
        ID.unique(),
        request
      ) as LeaveRequest;
    } catch (error) {
      this.handleError(error);
    }
  }
}
```

#### Storage Service
```typescript
// services/StorageService.ts
export class StorageService extends AppwriteService {
  async uploadFile(
    bucketId: string, 
    file: File | Blob, 
    permissions?: string[]
  ): Promise<Models.File> {
    try {
      return await this.storage.createFile(
        bucketId,
        ID.unique(),
        file,
        permissions
      );
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async uploadAvatar(file: File | Blob): Promise<string> {
    try {
      const uploaded = await this.uploadFile('avatars', file);
      return this.storage.getFileView('avatars', uploaded.$id).href;
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async uploadAttendancePhoto(file: File | Blob): Promise<string> {
    try {
      const uploaded = await this.uploadFile('attendance-photos', file);
      return this.storage.getFileView('attendance-photos', uploaded.$id).href;
    } catch (error) {
      this.handleError(error);
    }
  }
  
  async uploadLeaveDocument(file: File | Blob): Promise<string> {
    try {
      const uploaded = await this.uploadFile('perizinan', file);
      return this.storage.getFileView('perizinan', uploaded.$id).href;
    } catch (error) {
      this.handleError(error);
    }
  }
  
  getFileUrl(bucketId: string, fileId: string): string {
    return this.storage.getFileView(bucketId, fileId).href;
  }
  
  async deleteFile(bucketId: string, fileId: string): Promise<void> {
    try {
      await this.storage.deleteFile(bucketId, fileId);
    } catch (error) {
      this.handleError(error);
    }
  }
}
```

### Step 5.2: Update React Native Components

#### Login Component Migration
```typescript
// app/auth/Login.tsx - Updated version
export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  
  // Initialize services
  const authService = new AuthService();
  
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    
    setLoading(true);
    try {
      const user = await authService.login(email, password);
      setUser(user);
      router.replace("/Dashboard");
    } catch (error: any) {
      Alert.alert("Login Failed", error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Rest of component remains the same...
}
```

#### Attendance Photo Upload Migration
```typescript
// app/attendance/CameraAttendance.tsx - Updated version
const uploadPhoto = async (photoUri: string): Promise<string> => {
  try {
    // Compress image as before
    const compressedImage = await ImageManipulator.manipulateAsync(
      photoUri,
      [{ resize: { width: 800 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    
    // Convert to blob for Appwrite
    const response = await fetch(compressedImage.uri);
    const blob = await response.blob();
    
    // Upload using new service
    const storageService = new StorageService();
    const photoUrl = await storageService.uploadAttendancePhoto(blob);
    
    return photoUrl;
  } catch (error) {
    console.error("Upload failed:", error);
    throw new Error("Failed to upload photo");
  }
};

const submitAttendance = async () => {
  if (!user || !photoUri) return;
  
  setLoading(true);
  try {
    // Upload photo
    const photoUrl = await uploadPhoto(photoUri);
    
    // Create absence record
    const databaseService = new DatabaseService();
    await databaseService.createAbsence({
      userId: user.$id,
      date: new Date().toISOString(),
      status: attendanceType,
      photoUrl,
      latitude: location?.coords.latitude,
      longitude: location?.coords.longitude,
    });
    
    Alert.alert("Success", "Attendance recorded successfully");
    router.back();
  } catch (error: any) {
    Alert.alert("Error", error.message);
  } finally {
    setLoading(false);
  }
};
```

### Step 5.3: Update Store Integration

#### Auth Store Update
```typescript
// store/authStore.ts - Final Appwrite version
import { create } from 'zustand';
import { Models } from 'appwrite';
import { AuthService } from '~/services/AuthService';

interface AuthState {
  user: Models.User<Models.Preferences> | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  updateProfile: (data: any) => Promise<void>;
}

const authService = new AuthService();

const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: false,
  
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const user = await authService.login(email, password);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  register: async (email: string, password: string, name?: string) => {
    set({ isLoading: true });
    try {
      const user = await authService.register(email, password, name);
      set({ user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
  
  logout: async () => {
    try {
      await authService.logout();
      set({ user: null });
    } catch (error) {
      console.error('Logout error:', error);
      // Clear local state even if logout fails
      set({ user: null });
    }
  },
  
  checkAuth: async () => {
    try {
      const user = await authService.getCurrentUser();
      set({ user });
    } catch (error) {
      set({ user: null });
    }
  },
  
  updateProfile: async (data: any) => {
    try {
      const user = await authService.updateProfile(data);
      set({ user });
    } catch (error) {
      throw error;
    }
  },
}));

export default useAuthStore;
```

### Validation Criteria
- [ ] All authentication flows working with Appwrite
- [ ] Database operations completed successfully
- [ ] File uploads functional
- [ ] Error handling working correctly
- [ ] Performance within acceptable limits
- [ ] Mobile app functionality preserved

---

This completes the phase-by-phase migration guide. Each phase builds upon the previous ones and includes comprehensive validation criteria to ensure successful migration at each step.

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Next Review**: Weekly during migration phases