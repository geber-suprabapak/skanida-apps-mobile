# Supabase to Appwrite Migration Guide

This document provides a comprehensive guide for migrating the Skanida Apps Mobile application from Supabase to Appwrite.

## Table of Contents

1. [Migration Overview](#migration-overview)
2. [Why Migrate to Appwrite](#why-migrate-to-appwrite)
3. [Pre-Migration Checklist](#pre-migration-checklist)
4. [Step-by-Step Migration Process](#step-by-step-migration-process)
5. [Data Migration Strategy](#data-migration-strategy)
6. [Testing and Validation](#testing-and-validation)
7. [Rollback Plan](#rollback-plan)
8. [Post-Migration Tasks](#post-migration-tasks)

## Migration Overview

### Current Architecture (Supabase)
- **Authentication**: Supabase Auth with email/password
- **Database**: PostgreSQL with tables: `user_profiles`, `absences`, `perizinan`
- **Storage**: Supabase Storage with buckets: `attendance-photos`, `perizinan`, `avatars`
- **Real-time**: Supabase Realtime subscriptions

### Target Architecture (Appwrite)
- **Authentication**: Appwrite Account API with email/password
- **Database**: Appwrite NoSQL database with collections matching Supabase tables
- **Storage**: Appwrite Storage with equivalent bucket structure
- **Real-time**: Appwrite Realtime subscriptions

## Why Migrate to Appwrite

### Benefits
✅ **Self-hosting option** - Better control over infrastructure  
✅ **Competitive pricing** - More cost-effective at scale  
✅ **Unified SDK** - Consistent API across all platforms  
✅ **Built-in permissions** - More granular security controls  
✅ **Active development** - Rapid feature releases  
✅ **Docker-based** - Easy deployment and scaling  

### Considerations
⚠️ **Learning curve** - Different API patterns and concepts  
⚠️ **NoSQL paradigm** - Requires adapting from SQL mindset  
⚠️ **Migration effort** - Comprehensive code changes required  
⚠️ **Ecosystem maturity** - Smaller community compared to Supabase  

## Pre-Migration Checklist

### 1. Environment Setup
- [ ] Appwrite project created and configured
- [ ] Database collections and storage buckets set up
- [ ] Environment variables prepared
- [ ] Backup of current Supabase data

### 2. Code Preparation
- [ ] Appwrite SDK already installed (`appwrite@20.0.0`)
- [ ] Migration utilities reviewed and tested
- [ ] Component inventory completed
- [ ] Test plan created

### 3. Data Backup
- [ ] Export all user profiles from Supabase
- [ ] Export attendance records (absences table)
- [ ] Export leave requests (perizinan table)
- [ ] Download all uploaded files from storage

## Step-by-Step Migration Process

### Phase 1: Authentication Migration

#### 1.1 Update Login Component

**File**: `app/auth/Login.tsx`

Replace Supabase auth calls:
```typescript
// Before (Supabase)
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// After (Appwrite)
import { appwriteAuth } from "~/utils/migration";
const result = await appwriteAuth.signIn(email, password);
```

#### 1.2 Update Registration Component

**File**: `app/auth/Register.tsx`

Replace registration logic:
```typescript
// Before (Supabase)
const { data, error } = await supabase.auth.signUp({
  email,
  password,
});

// After (Appwrite)
const result = await appwriteAuth.signUp(email, password, fullName);
```

#### 1.3 Update Auth Store

**File**: `store/authStore.ts`

Update to handle Appwrite user objects:
```typescript
// Update user state management to work with Appwrite user structure
interface AuthState {
  user: Models.User<Models.Preferences> | null; // Appwrite user type
  setUser: (user: Models.User<Models.Preferences> | null) => void;
}
```

### Phase 2: Database Migration

#### 2.1 Profile Management

**Files**: `app/profile/EditProfile.tsx`, `app/profile/ChangePassword.tsx`

Replace database operations:
```typescript
// Before (Supabase)
const { error } = await supabase
  .from('user_profiles')
  .upsert({ user_id, full_name, email });

// After (Appwrite)
import { userProfilesService } from "~/utils/migration";
const result = await userProfilesService.upsertProfile({
  user_id, full_name, email
});
```

#### 2.2 Attendance System

**Files**: Attendance-related components

Update absence tracking:
```typescript
// Before (Supabase)
const { data, error } = await supabase
  .from('absences')
  .insert({ user_id, date, status, photo_url });

// After (Appwrite)
import { absencesService } from "~/utils/migration";
const result = await absencesService.createAbsence({
  user_id, date, status, photo_url
});
```

#### 2.3 Leave Requests (Perizinan)

**Files**: `app/perizinan/izin.tsx`

Update leave request operations:
```typescript
// Before (Supabase)
const { data, error } = await supabase
  .from('perizinan')
  .insert({ user_id, kategori_izin, deskripsi });

// After (Appwrite)
import { perizinanService } from "~/utils/migration";
const result = await perizinanService.createLeaveRequest({
  user_id, kategori_izin, deskripsi
});
```

### Phase 3: Storage Migration

#### 3.1 File Upload Operations

Replace Supabase storage calls with Appwrite equivalents:

```typescript
// Before (Supabase)
const { data, error } = await supabase.storage
  .from('attendance-photos')
  .upload(fileName, file);

// After (Appwrite)
import { storage, appwriteConfig } from "~/utils/appwrite";
const result = await storage.createFile(
  appwriteConfig.attendancePhotosStorage,
  ID.unique(),
  file
);
```

#### 3.2 File Download and URL Generation

Update file access patterns:
```typescript
// Before (Supabase)
const { data } = supabase.storage
  .from('attendance-photos')
  .getPublicUrl(fileName);

// After (Appwrite)
import { storage, appwriteConfig } from "~/utils/appwrite";
const url = storage.getFileView(
  appwriteConfig.attendancePhotosStorage,
  fileId
);
```

### Phase 4: Environment Configuration

#### 4.1 Update Environment Variables

Replace Supabase variables with Appwrite configuration:

```env
# Remove or comment out Supabase variables
# EXPO_PUBLIC_SUPABASE_URL=...
# EXPO_PUBLIC_SUPABASE_ANON_KEY=...

# Add Appwrite configuration
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_project_id
EXPO_PUBLIC_APPWRITE_DATABASE_ID=skanida-main-db
EXPO_PUBLIC_APPWRITE_USER_PROFILES_COLLECTION_ID=user_profiles
EXPO_PUBLIC_APPWRITE_ABSENCES_COLLECTION_ID=absences
EXPO_PUBLIC_APPWRITE_PERIZINAN_COLLECTION_ID=perizinan
EXPO_PUBLIC_APPWRITE_ATTENDANCE_PHOTOS_STORAGE=attendance-photos
EXPO_PUBLIC_APPWRITE_PERIZINAN_STORAGE=perizinan
EXPO_PUBLIC_APPWRITE_AVATARS_STORAGE=avatars
```

#### 4.2 Update Main App Configuration

Ensure the app initializes with Appwrite instead of Supabase:

```typescript
// In your main app file or auth initialization
import { appwriteAuth } from "~/utils/migration";

// Check for existing session on app start
const checkAuthState = async () => {
  const result = await appwriteAuth.getSession();
  if (result.success) {
    // User is authenticated
    setUser(result.data);
  }
};
```

## Data Migration Strategy

### Option 1: Fresh Start (Recommended for Development)
- Start with empty Appwrite database
- Users re-register and create new data
- Simplest approach with no data consistency issues

### Option 2: Gradual Migration
- Run both backends simultaneously
- Gradually migrate user by user
- More complex but allows seamless transition

### Option 3: Full Data Export/Import
- Export all data from Supabase
- Transform and import into Appwrite
- Requires careful ID mapping and validation

### Recommended Approach for Skanida Apps

For this application, we recommend **Option 1 (Fresh Start)** because:
- The app is in development/internal use
- Data volume is manageable
- Ensures clean migration without legacy issues
- Simplifies testing and validation

## Testing and Validation

### 1. Unit Testing

Test each migrated component:
```bash
# Run existing tests with new backend
npm test

# Test specific migration utilities
npm test -- --testPathPattern=migration
```

### 2. Integration Testing

Test complete user workflows:
- [ ] User registration and email verification
- [ ] User login and session persistence
- [ ] Profile creation and updates
- [ ] Attendance photo upload and retrieval
- [ ] Leave request submission
- [ ] Password change functionality

### 3. Performance Testing

Compare performance metrics:
- [ ] Authentication response times
- [ ] Database query performance
- [ ] File upload/download speeds
- [ ] App startup time with new backend

### 4. Manual Testing Checklist

- [ ] Install app with Appwrite configuration
- [ ] Create new user account
- [ ] Upload profile photo
- [ ] Submit attendance with photo
- [ ] Create leave request with document
- [ ] Update profile information
- [ ] Change password
- [ ] Logout and login again
- [ ] Test offline/online sync (if applicable)

## Rollback Plan

### Preparation
1. **Keep Supabase configuration** in codebase (commented out)
2. **Maintain Supabase project** during transition period
3. **Create rollback branch** before migration deployment

### Rollback Procedure
If issues arise with Appwrite migration:

1. **Switch environment variables** back to Supabase
2. **Revert code changes** to use Supabase imports
3. **Deploy previous version** from rollback branch
4. **Investigate and fix** Appwrite issues
5. **Retry migration** once issues are resolved

### Rollback Code Example
```typescript
// Keep this pattern for easy rollback
const USE_APPWRITE = process.env.EXPO_PUBLIC_USE_APPWRITE === 'true';

if (USE_APPWRITE) {
  // Appwrite implementation
  const result = await appwriteAuth.signIn(email, password);
} else {
  // Supabase implementation (fallback)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
}
```

## Post-Migration Tasks

### 1. Monitoring and Observability
- [ ] Set up Appwrite logging and monitoring
- [ ] Monitor error rates and performance
- [ ] Set up alerts for critical failures

### 2. Documentation Updates
- [ ] Update README with new setup instructions
- [ ] Update API documentation
- [ ] Update deployment guides

### 3. Team Training
- [ ] Train development team on Appwrite concepts
- [ ] Update development workflows
- [ ] Create troubleshooting guides

### 4. Cleanup Tasks
- [ ] Remove Supabase dependencies (after successful migration)
- [ ] Clean up unused environment variables
- [ ] Archive migration utilities
- [ ] Update CI/CD pipelines

### 5. Performance Optimization
- [ ] Optimize database queries and indexes
- [ ] Configure caching strategies
- [ ] Optimize file storage and CDN settings

## Migration Timeline

### Week 1: Preparation
- [ ] Complete Appwrite setup
- [ ] Finalize migration plan
- [ ] Set up testing environment

### Week 2: Core Migration
- [ ] Migrate authentication
- [ ] Update database operations
- [ ] Migrate storage operations

### Week 3: Testing and Validation
- [ ] Comprehensive testing
- [ ] Performance validation
- [ ] Bug fixes and optimization

### Week 4: Deployment and Monitoring
- [ ] Deploy to production
- [ ] Monitor for issues
- [ ] Complete post-migration tasks

## Success Criteria

Migration is considered successful when:
- [ ] All authentication flows work correctly
- [ ] All database operations function properly
- [ ] File upload/download works seamlessly
- [ ] Performance meets or exceeds Supabase baseline
- [ ] No critical bugs in production
- [ ] Team is comfortable with new stack

## Support and Resources

- **Appwrite Documentation**: https://appwrite.io/docs
- **Migration Utilities**: See `utils/migration/` directory
- **Team Slack Channel**: #appwrite-migration
- **Emergency Contacts**: List key team members for rollback decisions

---

**Note**: This migration guide should be updated based on actual implementation experience and any issues encountered during the process.