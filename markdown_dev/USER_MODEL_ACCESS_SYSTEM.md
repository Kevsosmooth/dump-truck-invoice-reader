# User Model Access System - Implementation Plan

## Overview
Transform the current global model configuration (via .env) into a granular per-user model access system where admins can assign specific models to individual users with custom naming and default values.

## Requirements

### Business Requirements
1. **Per-User Model Access**
   - Admin assigns specific Azure models to specific users
   - Users only see models they have access to
   - Different users can have different models

2. **Custom Model Naming**
   - Admin sets user-friendly display names
   - Can override names per user if needed
   - Hide technical Azure model IDs from users

3. **Default Field Values**
   - Configure defaults when extraction fails
   - Support different default types (static, dynamic)
   - Prevent empty or invalid data in reports

4. **Admin Control**
   - Full visibility of who has access to what
   - Easy assignment/revocation of access
   - Audit trail of access changes

## Current vs. Desired State

### Current Implementation
```javascript
// Client uses .env configuration
VITE_AZURE_CUSTOM_MODEL_ID="Silvi_Reader_Full_2.0"

// All users see same model
// No custom naming
// No default values
// No per-user control
```

### Desired Implementation
```javascript
// User sees their assigned models
const models = await api.get('/api/models');
// Returns: [
//   { id: '1', displayName: 'Invoice Reader Pro', azureModelId: 'Silvi_Reader_Full_2.0' },
//   { id: '2', displayName: 'Receipt Scanner', azureModelId: 'Receipt_Model_v1' }
// ]

// With default values applied
if (!extractedData.companyName) {
  extractedData.companyName = 'Unknown Company'; // Admin-configured default
}
```

## Database Schema Updates

### Enhanced Schema
```prisma
model ModelConfiguration {
  id              String    @id @default(cuid())
  azureModelId    String    @unique
  displayName     String    
  description     String?
  isActive        Boolean   @default(true)
  // Remove isPublic - not needed for per-user access
  fields          FieldConfiguration[]
  access          ModelAccess[]
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model ModelAccess {
  id          String             @id @default(cuid())
  userId      String
  modelId     String
  customName  String?            // Optional user-specific name override
  isActive    Boolean   @default(true)
  grantedAt   DateTime  @default(now())
  grantedBy   String?           // Track which admin granted access
  expiresAt   DateTime?         // Optional expiration
  
  user        User              @relation(fields: [userId], references: [id])
  model       ModelConfiguration @relation(fields: [modelId], references: [id])
  grantedByUser User?          @relation("GrantedBy", fields: [grantedBy], references: [id])
  
  @@unique([userId, modelId])
  @@index([userId])
  @@index([modelId])
}

model FieldConfiguration {
  id            String              @id @default(cuid())
  modelId       String
  fieldName     String              // Azure field name (e.g., "Company_Name")
  displayName   String              // User-friendly name (e.g., "Company")
  fieldType     FieldType           // text, date, number, currency
  defaultType   FieldDefaultType    
  defaultValue  String?             
  isRequired    Boolean             @default(false)
  validation    Json?               // Optional validation rules
  
  model         ModelConfiguration  @relation(fields: [modelId], references: [id], onDelete: Cascade)
  
  @@unique([modelId, fieldName])
}

enum FieldType {
  TEXT
  DATE
  NUMBER
  CURRENCY
  BOOLEAN
}

enum FieldDefaultType {
  STATIC          // Fixed value
  TODAY          // Current date
  CURRENT_USER   // Logged-in user
  ORGANIZATION   // User's org
  EMPTY          // Empty string
  CALCULATED     // Formula-based
}
```

## Implementation Plan

### Phase 1: Database & Core Services (Week 1)

#### 1.1 Database Migration
```sql
-- Create tables for model configuration
CREATE TABLE "ModelConfiguration" (
    "id" TEXT NOT NULL,
    "azureModelId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "ModelConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelConfiguration_azureModelId_key" ON "ModelConfiguration"("azureModelId");

-- User access table
CREATE TABLE "ModelAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "customName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grantedBy" TEXT,
    "expiresAt" TIMESTAMP(3),
    
    CONSTRAINT "ModelAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModelAccess_userId_modelId_key" ON "ModelAccess"("userId", "modelId");
```

#### 1.2 Model Service
```javascript
// server/src/services/model-manager.js
export class ModelManager {
  async getUserModels(userId) {
    const access = await prisma.modelAccess.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      },
      include: {
        model: {
          include: { fields: true }
        }
      }
    });
    
    return access.map(a => ({
      id: a.model.id,
      displayName: a.customName || a.model.displayName,
      azureModelId: a.model.azureModelId,
      fields: a.model.fields
    }));
  }
  
  async grantAccess(userId, modelId, grantedBy, customName) {
    return await prisma.modelAccess.create({
      data: {
        userId,
        modelId,
        grantedBy,
        customName
      }
    });
  }
  
  async applyFieldDefaults(modelId, extractedData, context) {
    const fields = await prisma.fieldConfiguration.findMany({
      where: { modelId }
    });
    
    for (const field of fields) {
      if (!extractedData[field.fieldName] || extractedData[field.fieldName] === '') {
        extractedData[field.fieldName] = await this.getDefaultValue(field, context);
      }
    }
    
    return extractedData;
  }
  
  async getDefaultValue(field, context) {
    switch (field.defaultType) {
      case 'STATIC':
        return field.defaultValue || '';
        
      case 'TODAY':
        return new Date().toISOString().split('T')[0];
        
      case 'CURRENT_USER':
        return context.user?.name || 'Unknown User';
        
      case 'ORGANIZATION':
        return context.user?.organization?.name || 'Unknown Org';
        
      case 'EMPTY':
        return '';
        
      case 'CALCULATED':
        // Parse and evaluate formula
        return this.evaluateFormula(field.defaultValue, context);
        
      default:
        return '';
    }
  }
}
```

### Phase 2: Admin Interface (Week 1-2)

#### 2.1 Models Management Page
```jsx
// admin/src/pages/Models.jsx
export function Models() {
  return (
    <div>
      <Tabs defaultValue="models">
        <TabsList>
          <TabsTrigger value="models">Model Configurations</TabsTrigger>
          <TabsTrigger value="access">User Access</TabsTrigger>
          <TabsTrigger value="fields">Field Defaults</TabsTrigger>
        </TabsList>
        
        <TabsContent value="models">
          <ModelsList />
          <AddModelDialog />
        </TabsContent>
        
        <TabsContent value="access">
          <UserAccessManager />
        </TabsContent>
        
        <TabsContent value="fields">
          <FieldConfigurationEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

#### 2.2 User Access Assignment
```jsx
// admin/src/components/UserAccessManager.jsx
export function UserAccessManager() {
  const [selectedModel, setSelectedModel] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Model Selection */}
      <div>
        <h3>Select Model</h3>
        <ModelSelector onSelect={setSelectedModel} />
        
        {selectedModel && (
          <CurrentAccessList modelId={selectedModel.id} />
        )}
      </div>
      
      {/* User Assignment */}
      <div>
        <h3>Assign to Users</h3>
        <UserSearch onSelect={(users) => setSelectedUsers(users)} />
        
        <div className="mt-4">
          <Label>Custom Display Name (Optional)</Label>
          <Input placeholder="Leave empty to use default" />
          
          <Label>Access Expiration (Optional)</Label>
          <DatePicker />
          
          <Button onClick={handleGrantAccess}>
            Grant Access to {selectedUsers.length} Users
          </Button>
        </div>
      </div>
    </div>
  );
}
```

#### 2.3 Field Configuration
```jsx
// admin/src/components/FieldConfigurationEditor.jsx
export function FieldConfigurationEditor({ modelId }) {
  const { data: fields } = useQuery(['fields', modelId], () => 
    api.get(`/admin/models/${modelId}/fields`)
  );
  
  return (
    <div>
      {fields.map(field => (
        <Card key={field.id} className="mb-4">
          <CardHeader>
            <h4>{field.displayName}</h4>
            <Badge>{field.fieldName}</Badge>
          </CardHeader>
          
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Default Type</Label>
                <Select value={field.defaultType} onChange={...}>
                  <SelectItem value="STATIC">Static Value</SelectItem>
                  <SelectItem value="TODAY">Today's Date</SelectItem>
                  <SelectItem value="CURRENT_USER">Current User</SelectItem>
                  <SelectItem value="EMPTY">Empty</SelectItem>
                </Select>
              </div>
              
              {field.defaultType === 'STATIC' && (
                <div>
                  <Label>Default Value</Label>
                  <Input 
                    value={field.defaultValue} 
                    placeholder={getPlaceholder(field.fieldType)}
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

### Phase 3: API Endpoints (Week 2)

#### 3.1 Admin Endpoints
```javascript
// server/src/routes/admin-models.js

// Model CRUD
router.get('/models', async (req, res) => {
  const models = await prisma.modelConfiguration.findMany({
    include: {
      _count: { select: { access: true } },
      fields: true
    }
  });
  res.json(models);
});

router.post('/models', async (req, res) => {
  const { azureModelId, displayName, description } = req.body;
  
  // Fetch fields from Azure
  const azureFields = await getModelFields(azureModelId);
  
  const model = await prisma.modelConfiguration.create({
    data: {
      azureModelId,
      displayName,
      description,
      fields: {
        create: azureFields.map(f => ({
          fieldName: f.name,
          displayName: formatFieldName(f.name),
          fieldType: mapAzureType(f.type),
          defaultType: 'EMPTY'
        }))
      }
    }
  });
  
  res.json(model);
});

// User Access Management
router.get('/models/:id/access', async (req, res) => {
  const access = await prisma.modelAccess.findMany({
    where: { modelId: req.params.id },
    include: {
      user: true,
      grantedByUser: true
    }
  });
  res.json(access);
});

router.post('/models/:id/access', async (req, res) => {
  const { userIds, customName, expiresAt } = req.body;
  const adminId = req.user.id;
  
  const results = await Promise.all(
    userIds.map(userId => 
      prisma.modelAccess.upsert({
        where: { userId_modelId: { userId, modelId: req.params.id } },
        create: {
          userId,
          modelId: req.params.id,
          customName,
          grantedBy: adminId,
          expiresAt
        },
        update: {
          isActive: true,
          customName,
          grantedBy: adminId,
          expiresAt
        }
      })
    )
  );
  
  res.json(results);
});
```

#### 3.2 Client Endpoints
```javascript
// server/src/routes/models.js

// Get user's available models
router.get('/models', authenticate, async (req, res) => {
  const modelManager = new ModelManager();
  const models = await modelManager.getUserModels(req.user.id);
  res.json(models);
});

// Get specific model details
router.get('/models/:id', authenticate, async (req, res) => {
  const access = await prisma.modelAccess.findFirst({
    where: {
      userId: req.user.id,
      modelId: req.params.id,
      isActive: true
    },
    include: {
      model: { include: { fields: true } }
    }
  });
  
  if (!access) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  res.json({
    id: access.model.id,
    displayName: access.customName || access.model.displayName,
    azureModelId: access.model.azureModelId,
    fields: access.model.fields
  });
});
```

### Phase 4: Client Updates (Week 2-3)

#### 4.1 Model Selection Component
```jsx
// client/src/components/ModelSelector.jsx
export function ModelSelector({ onSelect }) {
  const { data: models, isLoading } = useQuery('user-models', 
    () => api.get('/api/models')
  );
  
  if (isLoading) return <div>Loading models...</div>;
  
  if (!models || models.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No models available. Please contact your administrator.
        </AlertDescription>
      </Alert>
    );
  }
  
  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger>
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        {models.map(model => (
          <SelectItem key={model.id} value={model.id}>
            {model.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

#### 4.2 Update Document Processor
```javascript
// client/src/pages/Home.jsx
const handleProcessDocuments = async () => {
  const selectedModel = models.find(m => m.id === selectedModelId);
  
  if (!selectedModel) {
    toast.error('Please select a model');
    return;
  }
  
  // Use the Azure model ID from the selected model
  const formData = new FormData();
  formData.append('modelId', selectedModel.azureModelId);
  formData.append('configModelId', selectedModel.id); // For defaults
  
  files.forEach(file => {
    formData.append('files', file);
  });
  
  await api.post(`/api/sessions/${sessionId}/process`, formData);
};
```

### Phase 5: Default Value Processing (Week 3)

#### 5.1 Post-Processor Updates
```javascript
// server/src/services/post-processor.js
async function postProcessDocument(job, extractedData) {
  const modelManager = new ModelManager();
  
  // Get model configuration
  const session = await prisma.processingSession.findUnique({
    where: { id: job.sessionId },
    include: { user: true }
  });
  
  // Apply field defaults
  const context = {
    user: session.user,
    job,
    session
  };
  
  const processedData = await modelManager.applyFieldDefaults(
    job.modelConfigId,
    extractedData,
    context
  );
  
  // Generate new filename
  const companyName = processedData.Company_Name || 'Unknown';
  const ticketNumber = processedData.Ticket_Number || '000';
  const date = formatDate(processedData.Date) || getTodayDate();
  
  const newFileName = `${companyName}_${ticketNumber}_${date}.pdf`;
  
  return { processedData, newFileName };
}
```

### Phase 6: Migration & Deployment (Week 3-4)

#### 6.1 Data Migration Script
```javascript
// scripts/migrate-models.js
async function migrateExistingConfiguration() {
  // Get current .env model
  const envModelId = process.env.AZURE_CUSTOM_MODEL_ID;
  
  if (!envModelId) return;
  
  // Create model configuration
  const model = await prisma.modelConfiguration.create({
    data: {
      azureModelId: envModelId,
      displayName: 'Default Invoice Model',
      description: 'Migrated from environment configuration'
    }
  });
  
  // Grant access to all existing users
  const users = await prisma.user.findMany();
  
  await Promise.all(
    users.map(user => 
      prisma.modelAccess.create({
        data: {
          userId: user.id,
          modelId: model.id,
          grantedBy: 'system-migration'
        }
      })
    )
  );
  
  console.log(`Migrated model ${envModelId} and granted access to ${users.length} users`);
}
```

#### 6.2 Deployment Checklist
1. Apply database migrations
2. Deploy updated backend with model endpoints
3. Deploy updated admin dashboard
4. Run migration script
5. Test with sample users
6. Remove .env model configuration

## Security Considerations

1. **Access Control**
   - Validate user has access to model before processing
   - Check expiration dates
   - Log all access grants/revocations

2. **Data Privacy**
   - Don't expose Azure model IDs to end users
   - Sanitize default values before applying
   - Audit trail for configuration changes

3. **Rate Limiting**
   - Limit model queries per user
   - Cache user models for performance

## Testing Plan

1. **Unit Tests**
   - Model access validation
   - Default value application
   - Field type conversions

2. **Integration Tests**
   - End-to-end model assignment
   - Document processing with defaults
   - Access expiration handling

3. **User Acceptance Tests**
   - Admin can assign models
   - Users see only their models
   - Defaults apply correctly

## Success Metrics

1. **Adoption**
   - % of users with assigned models
   - Models assigned per user
   - Usage of custom names

2. **Quality**
   - Reduction in empty fields
   - Accuracy of default values
   - User satisfaction scores

3. **Performance**
   - Model query response time
   - Cache hit rate
   - Processing time impact

## Future Enhancements

1. **Model Templates**
   - Pre-configured model sets
   - Industry-specific defaults
   - Quick setup wizards

2. **Advanced Defaults**
   - Conditional defaults based on other fields
   - External data source integration
   - Machine learning suggestions

3. **Analytics**
   - Model usage statistics
   - Field extraction success rates
   - Default value effectiveness

## Timeline

- **Week 1**: Database schema, core services
- **Week 2**: Admin interface, API endpoints
- **Week 3**: Client updates, default processing
- **Week 4**: Testing, migration, deployment

Total estimated time: 4 weeks for full implementation