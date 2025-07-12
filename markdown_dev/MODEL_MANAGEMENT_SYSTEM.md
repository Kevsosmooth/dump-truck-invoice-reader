# Model Management System - Implementation Plan

## Overview
Implement a comprehensive model management system that allows admins to control which Azure Document Intelligence models are available to users, customize model names, manage field access, and set default values for missing fields.

## Current State Analysis
- **Client**: Currently hardcodes single model "Silvi_Reader_Full_2.0"
- **Backend**: Has endpoints for model info but no model listing
- **Admin**: No model management interface exists
- **Fields**: All fields from Azure are exposed to users
- **Defaults**: No default values for missing fields

## Required Features

### 1. Model Access Control
- Admin can enable/disable models for user access
- Admin can set which users/organizations have access to specific models
- Users only see models they have permission to use

### 2. Model Display Customization
- Admin can rename models with user-friendly names
- Original Azure model ID is hidden from users
- Admin can add descriptions to help users choose models

### 3. Field Management
- Admin can select which fields from a model are exposed to users
- Admin can rename fields with user-friendly names
- Admin can reorder fields for better UX

### 4. Default Value Configuration
- Admin can set default values for each field when extraction fails
- Support for different default types:
  - Static text (e.g., "Unknown", "000")
  - Dynamic values (e.g., current date, user's organization name)
  - Empty string (default if not configured)

## Database Schema Changes

```prisma
// Add to schema.prisma

model ModelConfiguration {
  id               String   @id @default(cuid())
  azureModelId     String   @unique // The actual Azure model ID
  displayName      String   // User-friendly name
  description      String?  // Help text for users
  isActive         Boolean  @default(true)
  isPublic         Boolean  @default(false) // Available to all users
  sortOrder        Int      @default(0) // Display order in dropdown
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  fieldConfigurations FieldConfiguration[]
  modelAccess         ModelAccess[]
}

model FieldConfiguration {
  id               String   @id @default(cuid())
  modelConfigId    String
  azureFieldName   String   // Original field name from Azure
  displayName      String   // User-friendly name
  description      String?
  isEnabled        Boolean  @default(true)
  isRequired       Boolean  @default(false)
  defaultValue     String?  // Default when extraction fails
  defaultType      String?  // 'static', 'currentDate', 'orgName', etc.
  sortOrder        Int      @default(0)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  
  modelConfiguration ModelConfiguration @relation(fields: [modelConfigId], references: [id], onDelete: Cascade)
  
  @@unique([modelConfigId, azureFieldName])
}

model ModelAccess {
  id               String   @id @default(cuid())
  modelConfigId    String
  userId           Int?     // Null means organization-level access
  organizationId   Int?     // Null means user-level access
  createdAt        DateTime @default(now())
  
  modelConfiguration ModelConfiguration @relation(fields: [modelConfigId], references: [id], onDelete: Cascade)
  user              User?              @relation(fields: [userId], references: [id], onDelete: Cascade)
  organization      Organization?      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@unique([modelConfigId, userId, organizationId])
}
```

## Implementation Tasks

### Phase 1: Backend Infrastructure

#### Task 1.1: Database Migration
- [ ] Create new Prisma migration with ModelConfiguration, FieldConfiguration, and ModelAccess models
- [ ] Add relations to existing User and Organization models
- [ ] Run migration on development database

#### Task 1.2: Model Service
Create `/server/src/services/model-manager.js`:
- [ ] Function to sync Azure models with database
- [ ] Function to get user's available models
- [ ] Function to get model with field configurations
- [ ] Function to apply default values to extracted data
- [ ] Function to check model access permissions

#### Task 1.3: API Endpoints
Create `/server/src/routes/model-config.js`:
- [ ] GET /api/models - List models available to current user
- [ ] GET /api/models/:id/config - Get model with field configurations
- [ ] POST /api/models/:id/extract - Process with field filtering and defaults

Update `/server/src/routes/admin/models.js`:
- [ ] GET /api/admin/models - List all Azure models
- [ ] GET /api/admin/models/configured - List configured models
- [ ] POST /api/admin/models/sync - Sync with Azure
- [ ] POST /api/admin/models/configure - Create model configuration
- [ ] PUT /api/admin/models/:id - Update model configuration
- [ ] DELETE /api/admin/models/:id - Delete model configuration
- [ ] GET /api/admin/models/:id/fields - Get field configurations
- [ ] PUT /api/admin/models/:id/fields - Update field configurations
- [ ] POST /api/admin/models/:id/access - Manage model access

### Phase 2: Admin Interface

#### Task 2.1: Models Management Page
Create `/admin/src/pages/Models.jsx`:
- [ ] List all Azure models with sync status
- [ ] Show configured vs unconfigured models
- [ ] Enable/disable models for users
- [ ] Set display names and descriptions
- [ ] Manage model access (public/private)
- [ ] Drag-and-drop to reorder models

#### Task 2.2: Model Configuration Modal
Create `/admin/src/components/models/ModelConfigModal.jsx`:
- [ ] Basic settings tab (name, description, status)
- [ ] Fields management tab
  - [ ] Toggle fields on/off
  - [ ] Rename fields
  - [ ] Set field descriptions
  - [ ] Configure default values
  - [ ] Reorder fields
- [ ] Access control tab
  - [ ] Set public/private
  - [ ] Manage user/organization access
  - [ ] View access audit log

#### Task 2.3: Field Default Value Editor
Create `/admin/src/components/models/FieldDefaultEditor.jsx`:
- [ ] Static text input
- [ ] Dynamic value selection:
  - [ ] Current date (with format selection)
  - [ ] User's organization name
  - [ ] User's email
  - [ ] Custom formula builder
- [ ] Preview of default value
- [ ] Validation rules

#### Task 2.4: Model Sync Tool
Create `/admin/src/components/models/ModelSyncTool.jsx`:
- [ ] Fetch latest models from Azure
- [ ] Show new/updated/deleted models
- [ ] Selective sync options
- [ ] Backup current configurations
- [ ] Migration warnings

### Phase 3: Client Updates

#### Task 3.1: Dynamic Model Loading
Update `/client/src/App.jsx`:
- [ ] Fetch available models on component mount
- [ ] Display models with custom names and descriptions
- [ ] Show loading state while fetching models
- [ ] Handle no models available scenario

#### Task 3.2: Field Display Updates
- [ ] Use configured field names instead of Azure names
- [ ] Only show enabled fields
- [ ] Apply field ordering from configuration
- [ ] Show field descriptions in tooltips

#### Task 3.3: Processing Updates
Update document processing flow:
- [ ] Send model configuration ID instead of Azure model ID
- [ ] Receive processed data with default values applied
- [ ] Update file rename builder with configured fields

### Phase 4: Default Value Processing

#### Task 4.1: Backend Processing
Update `/server/src/services/document-processor.js`:
- [ ] Load field configurations for model
- [ ] Apply default values for missing fields
- [ ] Handle different default types:
  - [ ] Static text
  - [ ] Current date with formatting
  - [ ] Dynamic values from context
- [ ] Validate required fields

#### Task 4.2: Excel Export Updates
Update `/server/src/services/excel-generator.js`:
- [ ] Use configured field names as column headers
- [ ] Include all configured fields even if empty
- [ ] Apply default values in Excel cells
- [ ] Maintain field ordering from configuration

### Phase 5: Testing & Migration

#### Task 5.1: Testing
- [ ] Unit tests for model service
- [ ] API endpoint tests
- [ ] Admin UI component tests
- [ ] Client integration tests
- [ ] Default value processing tests

#### Task 5.2: Migration Strategy
- [ ] Script to import existing model into configuration
- [ ] Preserve current user access during migration
- [ ] Backup and rollback procedures
- [ ] Performance testing with multiple models

## Implementation Order

1. **Backend First** (Tasks 1.1-1.3)
   - Database schema and migration
   - Core services and utilities
   - API endpoints

2. **Admin Interface** (Tasks 2.1-2.4)
   - Models list page
   - Configuration modal
   - Field management
   - Access control

3. **Client Updates** (Tasks 3.1-3.3)
   - Dynamic model loading
   - Field display updates
   - Processing integration

4. **Default Values** (Tasks 4.1-4.2)
   - Backend processing
   - Excel export updates

5. **Testing & Deployment** (Tasks 5.1-5.2)
   - Comprehensive testing
   - Migration execution

## Security Considerations

1. **Access Control**
   - Verify model access on every request
   - Audit log for configuration changes
   - Rate limiting for model sync operations

2. **Data Validation**
   - Sanitize custom field names and descriptions
   - Validate default values before applying
   - Prevent script injection in dynamic values

3. **Performance**
   - Cache model configurations
   - Lazy load field configurations
   - Optimize access control queries

## Success Metrics

1. **Admin Experience**
   - Time to configure a new model < 5 minutes
   - All Azure models discoverable
   - Clear audit trail of changes

2. **User Experience**
   - Model selection intuitive with descriptions
   - Only relevant fields displayed
   - Consistent data with defaults applied

3. **System Performance**
   - Model list API response < 200ms
   - No impact on document processing speed
   - Efficient caching reduces Azure API calls