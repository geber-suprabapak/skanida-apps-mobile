# Appwrite Migration P2oC Documentation

## Overview

This Proof of Concept (P2oC) demonstrates the migration path from Supabase to Appwrite for the Skanida Apps Mobile React Native application. The migration maintains all existing functionality while providing a clear upgrade path to Appwrite's backend services.

## What's Included

### 1. Core Migration Utilities (`utils/migration/`)

- **`authMigration.ts`** - Authentication service migration from Supabase Auth to Appwrite Account API
- **`databaseMigration.ts`** - Database operations migration from Supabase PostgreSQL to Appwrite Collections
- **`storageMigration.ts`** - File storage migration from Supabase Storage to Appwrite Storage
- **`index.ts`** - Unified exports and migration documentation

### 2. Appwrite Client Configuration (`utils/appwrite.ts`)

- Appwrite SDK setup and configuration
- Service initialization (Account, Databases, Storage)
- Environment variable configuration
- Type-safe exports for all services

### 3. Migration Examples (`examples/migration/`)

- **`LoginMigration.tsx`** - Shows how to migrate authentication flows
- **`ProfileMigration.tsx`** - Demonstrates profile management migration
- **`FileUploadMigration.tsx`** - File upload and storage migration examples

### 4. Environment Configuration

- **`.env.example`** - Complete environment variable template
- Configuration for both Supabase (existing) and Appwrite (new)
- Migration mode settings and backend selection

## Key Migration Components

### Authentication Migration

```typescript
// Before (Supabase)
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// After (Appwrite)
import { appwriteAuth } from '~/utils/migration';
const result = await appwriteAuth.signIn(email, password);
```

### Database Migration

```typescript
// Before (Supabase)
const { data, error } = await supabase
  .from('user_profiles')
  .upsert({ user_id: userId, full_name: name });

// After (Appwrite)
import { userProfilesService } from '~/utils/migration';
const result = await userProfilesService.upsertProfile({
  user_id: userId,
  full_name: name,
});
```

### Storage Migration

```typescript
// Before (Supabase)
const { data, error } = await supabase.storage
  .from('attendance-photos')
  .upload(fileName, fileBuffer);

// After (Appwrite)
import { attendancePhotosStorage } from '~/utils/migration';
const result = await attendancePhotosStorage.uploadAttendancePhoto(blob, fileName);
```

## Implementation Steps

### 1. Install Dependencies

```bash
npm install appwrite
```

### 2. Set Up Appwrite Project

1. Create an Appwrite Cloud account or set up self-hosted instance
2. Create a new project
3. Set up database with collections matching Supabase tables
4. Create storage buckets for files
5. Configure authentication providers

### 3. Configure Environment

Copy `.env.example` to `.env` and update with your Appwrite project details:

```env
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
EXPO_PUBLIC_APPWRITE_DATABASE_ID=your_database_id
# ... other configuration
```

### 4. Database Schema Migration

Create Appwrite collections that match the Supabase schema:

#### User Profiles Collection
- **Collection ID**: `user_profiles`
- **Attributes**:
  - `user_id` (string, required)
  - `full_name` (string)
  - `email` (string)
  - `absence_number` (string)
  - `class_name` (string)
  - `avatar_url` (string)
  - `role` (string)
  - `created_at` (datetime)
  - `updated_at` (datetime)

#### Absences Collection
- **Collection ID**: `absences`
- **Attributes**:
  - `user_id` (string, required)
  - `date` (string, required)
  - `status` (string, required) - enum: 'Hadir', 'Datang', 'Pulang'
  - `reason` (string)
  - `photo_url` (string)
  - `latitude` (float)
  - `longitude` (float)
  - `created_at` (datetime)

#### Perizinan Collection
- **Collection ID**: `perizinan`
- **Attributes**:
  - `user_id` (string, required)
  - `kategori_izin` (string, required) - enum: 'sakit', 'pergi'
  - `deskripsi` (string)
  - `link_foto` (string)
  - `tanggal` (datetime)
  - `approval_status` (string, default: 'pending') - enum: 'pending', 'approved', 'rejected'
  - `status` (boolean, default: false)
  - `created_at` (datetime)
  - `updated_at` (datetime)

### 5. Storage Bucket Setup

Create storage buckets:
- `attendance-photos` - For attendance verification photos
- `perizinan` - For leave request documents
- `avatars` - For user profile pictures

### 6. Code Migration

Replace Supabase calls with Appwrite equivalents:

```typescript
// Replace Supabase imports
// import { supabase } from '~/utils/supabase';
import { appwriteAuth, userProfilesService, attendancePhotosStorage } from '~/utils/migration';
```

## Testing the Migration

### 1. Authentication Flow
- Test login/logout functionality
- Verify session persistence
- Test password updates

### 2. Database Operations
- Test profile creation and updates
- Test attendance record creation
- Test leave request management

### 3. File Upload
- Test photo uploads for attendance
- Test document uploads for leave requests
- Test avatar uploads

## Migration Benefits

### Technical Benefits
- **Self-hosted option** - Full control over your backend
- **Better pricing** - More predictable costs at scale
- **Unified SDK** - Consistent API across all platforms
- **Real-time capabilities** - Built-in real-time subscriptions
- **Advanced permissions** - Granular access control

### Development Benefits
- **Type safety** - Better TypeScript support
- **Documentation** - Comprehensive API documentation
- **Community** - Active developer community
- **Performance** - Optimized for modern applications

## Considerations

### Data Modeling
- Appwrite uses NoSQL collections vs Supabase PostgreSQL
- Relationships handled differently between platforms
- Query syntax requires adaptation

### API Differences
- Response format differences (Supabase returns `{data, error}`, Appwrite returns result objects)
- Error handling patterns differ
- Authentication flow variations

### File Storage
- Different file permission models
- URL generation methods vary
- Upload format requirements differ

## Support and Resources

- [Appwrite Documentation](https://appwrite.io/docs)
- [Appwrite React Native SDK](https://appwrite.io/docs/quick-starts/react-native)
- [Migration Examples](./examples/migration/)
- [Supabase to Appwrite Migration Guide](https://appwrite.io/docs/migration/supabase)

## Next Steps

1. Review the P2oC implementation
2. Set up Appwrite project and configure environment
3. Test migration utilities with sample data
4. Plan phased migration approach
5. Implement gradual rollout strategy

This P2oC provides a solid foundation for migrating from Supabase to Appwrite while maintaining application functionality and improving backend capabilities.