# Dashboard Analytics Redesign Plan

## Implementation Status: ✅ COMPLETED

All dashboard analytics have been successfully implemented! The dashboard now displays real-time data from the database instead of static/mock values.

### What Was Implemented:
1. **Database Schema Updates**
   - Added analytics tracking fields to Job model (processingStartTime, processingEndTime, confidenceScores, etc.)
   - Created ExtractionAnalytics table for detailed field-level tracking
   - Updated CustomModel with analytics fields (totalExtractions, avgConfidenceScore, lastUsedAt)

2. **Backend Services**
   - Created comprehensive analytics service (`/server/src/services/analytics.js`)
   - Implemented `/api/user/dashboard/analytics` endpoint
   - Updated document processing to track all analytics data
   - Enhanced admin analytics to use the same service

3. **Frontend Updates**
   - All dashboard cards now display real data
   - Added loading states and error handling
   - Implemented 30-second auto-refresh
   - Model Performance card shows actual model usage

### Migration Instructions:
```bash
# Run the migration to add analytics fields
cd server
npx prisma migrate dev --name add-analytics-tracking
```

## Current Issues (RESOLVED)
The current dashboard displays static/mock data that doesn't reflect actual system usage:

### Top Stats Cards (App.jsx lines 1153-1181)
- Success Rate: Static 98.5% (should be calculated from completed/total jobs)
- Avg Processing Time: Static 12s (should be calculated from job processing times)
- Documents Today: Static 24 (should count today's ProcessingSession documents)
- Accuracy Score: Static 99.2% (should be average confidence from extractions)

### Model Performance Card (App.jsx lines 2054-2080)
- Model Version: Static v2.4.1 (should show actual model version)
- Confidence Score: Static 98.5% (should be average from recent extractions)
- Fields Extracted: Static 15/15 (should show actual extracted/available fields)

## Proposed Dashboard Analytics Cards

### 1. **Active Model Overview**
- **Model Name**: Currently selected model (e.g., "Silvi_Reader_Full_2.0")
- **Available Fields**: Count of fields marked as extractable in admin
- **Avg Confidence Score**: Average confidence across all extractions for this model
- **Total Extractions**: Number of documents processed with this model

### 2. **Processing Statistics**
- **Documents Today**: Actual count from ProcessingSession table (last 24h)
- **Documents This Week**: Count from last 7 days
- **Documents This Month**: Count from last 30 days
- **Avg Processing Time**: Calculate from job start/end times

### 3. **Success Metrics**
- **Overall Success Rate**: (Completed Jobs / Total Jobs) × 100
- **Today's Success Rate**: Success rate for last 24h
- **Failed Jobs**: Count with retry option
- **Average Retry Count**: How many retries are typically needed

### 4. **Model Performance Comparison**
- **All Models Accuracy**: Weighted average of all model confidence scores
- **Best Performing Model**: Model with highest avg confidence
- **Most Used Model**: Model with most extractions
- **Models Available**: Total count of accessible models

### 5. **Credit Usage Analytics**
- **Credits Used Today**: Sum of credits consumed in last 24h
- **Credits Remaining**: User's current credit balance
- **Avg Credits per Document**: Average pages processed
- **Credit Usage Trend**: Sparkline chart showing last 7 days

### 6. **Field Extraction Insights**
- **Most Extracted Fields**: Top 5 fields by extraction count
- **Highest Confidence Fields**: Fields with best accuracy
- **Lowest Confidence Fields**: Fields that need improvement
- **Field Success Rate**: Percentage of successful field extractions

## Database Schema Updates Needed

### 1. **Job Table Enhancement**
```prisma
model Job {
  // ... existing fields ...
  processingStartTime DateTime?
  processingEndTime   DateTime?
  confidenceScores    Json?     // Store confidence per field
  extractedFields     Json?     // Track which fields were extracted
  retryCount          Int       @default(0)
}
```

### 2. **CustomModel Table Enhancement**
```prisma
model CustomModel {
  // ... existing fields ...
  totalExtractions    Int       @default(0)
  avgConfidenceScore  Float     @default(0)
  lastUsedAt          DateTime?
}
```

### 3. **New Analytics Table**
```prisma
model ExtractionAnalytics {
  id               String    @id @default(cuid())
  modelId          String
  fieldName        String
  confidenceScore  Float
  extractionDate   DateTime  @default(now())
  userId          String
  jobId           String
  
  model           CustomModel @relation(fields: [modelId], references: [id])
  user            User        @relation(fields: [userId], references: [id])
  job             Job         @relation(fields: [jobId], references: [id])
  
  @@index([modelId, extractionDate])
  @@index([fieldName, extractionDate])
  @@index([userId, extractionDate])
}
```

## API Endpoints Needed

### 1. **GET /api/dashboard/analytics**
Returns all dashboard data in one call:
```javascript
{
  // For top stats cards
  stats: {
    successRate: {        // (completed jobs / total jobs) * 100
      value: 98.5,
      trend: "+2.3%"      // vs last period
    },
    avgProcessingTime: {  // average from job processingStartTime to processingEndTime
      value: "12s",
      trend: "-3s"        // vs last period
    },
    documentsToday: {     // count of jobs created today
      value: 24,
      trend: "+12"        // vs yesterday
    },
    accuracyScore: {      // average confidence score across all extractions
      value: 99.2,
      trend: "+0.5%"      // vs last period
    }
  },
  
  // For model performance card
  modelPerformance: {
    currentModel: {
      id: "model_123",
      version: "v2.4.1",
      displayName: "Silvi_Reader_Full_2.0"
    },
    avgConfidence: 98.5,    // average confidence from recent extractions
    fieldsExtracted: {
      successful: 15,       // count of successfully extracted fields
      total: 15            // total available fields
    },
    recentExtractions: []  // last 5 extractions with confidence scores
  },
  
  // Additional analytics
  activeModel: {
    id, name, availableFields, avgConfidence, totalExtractions
  },
  processingStats: {
    documentsToday, documentsWeek, documentsMonth, avgProcessingTime
  },
  successMetrics: {
    overallSuccessRate, todaySuccessRate, failedJobs, avgRetryCount
  },
  creditUsage: {
    creditsToday, creditsRemaining, avgCreditsPerDoc, usageTrend
  },
  fieldInsights: {
    mostExtracted, highestConfidence, lowestConfidence, fieldSuccessRate
  }
}
```

### 2. **GET /api/analytics/model/:modelId**
Get detailed analytics for a specific model

### 3. **GET /api/analytics/trends**
Get time-series data for charts

## Implementation Steps

### Phase 1: Database Updates
1. Create new Prisma migrations
2. Add analytics tracking to document processing:
   - Track `processingStartTime` and `processingEndTime` in Job model
   - Store `confidenceScores` JSON for each field extracted
   - Add `extractionCount` to track successful field extractions
3. Update job completion to store confidence scores

### Phase 2: Backend Analytics Service
1. Create `/server/src/services/analytics.js`:
   ```javascript
   // Calculate success rate
   const getSuccessRate = async (userId, timeframe) => {
     const jobs = await prisma.job.findMany({
       where: { userId, createdAt: { gte: timeframe } }
     });
     const completed = jobs.filter(j => j.status === 'COMPLETED').length;
     return (completed / jobs.length) * 100;
   };
   
   // Calculate average processing time
   const getAvgProcessingTime = async (userId, timeframe) => {
     const jobs = await prisma.job.findMany({
       where: {
         userId,
         status: 'COMPLETED',
         processingStartTime: { not: null },
         processingEndTime: { not: null },
         createdAt: { gte: timeframe }
       }
     });
     // Calculate average time in seconds
   };
   ```

2. Create API endpoint `/api/dashboard/analytics`
3. Add real-time data aggregation

### Phase 3: Dashboard UI Update
1. Update `App.jsx` to fetch real analytics:
   ```javascript
   // Replace static values with API call
   const { data: analytics } = useQuery({
     queryKey: ['dashboardAnalytics'],
     queryFn: async () => {
       const response = await fetchWithAuth(`${API_URL}/api/dashboard/analytics`);
       return response.json();
     },
     refetchInterval: 30000, // Refresh every 30 seconds
   });
   ```

2. Update StatCard components to use real data:
   ```jsx
   <StatCard
     icon={<TrendingUp className="h-5 w-5" />}
     title="Success Rate"
     value={analytics?.stats?.successRate?.value || '0%'}
     trend={analytics?.stats?.successRate?.trend}
     color="emerald"
   />
   ```

3. Update Model Performance card with real data

### Phase 4: Performance Optimization
1. Add database indexes for analytics queries
2. Implement Redis caching for expensive calculations
3. Add materialized views for common aggregations

## Database Migration Commands

```bash
# After updating schema.prisma with new fields and models
npx prisma migrate dev --name add-analytics-tracking

# To reset if needed during development
npx prisma migrate reset

# To apply migrations in production
npx prisma migrate deploy

# Generate Prisma client after schema changes
npx prisma generate

# Verify database is in sync
npx prisma migrate status
```

## TODO List

### Backend Tasks (Completed ✅)
- [x] Update Prisma schema with analytics fields (Job model enhancements)
- [x] Run database migration: `npx prisma migrate dev --name add-analytics-tracking`
- [x] Create ExtractionAnalytics table for detailed field tracking
- [x] Update document processing (`sync-document-processor.js`) to:
  - [x] Track processingStartTime when job begins
  - [x] Track processingEndTime when job completes
  - [x] Store confidence scores for each extracted field
  - [x] Count successful field extractions
  - [x] Create ExtractionAnalytics records for field-level tracking
- [x] Create analytics service (`/server/src/services/analytics.js`):
  - [x] Implement getSuccessRate function
  - [x] Implement getAvgProcessingTime function
  - [x] Implement getDocumentsToday function
  - [x] Implement getAccuracyScore function
  - [x] Implement getModelPerformance function
  - [x] Implement getAdminAnalytics function
- [x] Build `/api/user/dashboard/analytics` endpoint
- [x] Add database indexes for performance (in schema.prisma)

### Frontend Tasks (Completed ✅)
- [x] Create fetchAnalytics function for fetching dashboard data
- [x] Update App.jsx StatCard components:
  - [x] Replace static "98.5%" with `analytics?.stats?.successRate?.value`
  - [x] Replace static "12s" with `analytics?.stats?.avgProcessingTime?.value`
  - [x] Replace static "24" with `analytics?.stats?.documentsToday?.value`
  - [x] Replace static "99.2%" with `analytics?.stats?.accuracyScore?.value`
- [x] Update Model Performance card:
  - [x] Replace static "v2.4.1" with `analytics?.modelPerformance?.currentModel?.displayName`
  - [x] Replace static "98.5%" with `analytics?.modelPerformance?.avgConfidence`
  - [x] Replace static "15/15" with dynamic fields extracted
- [x] Add loading states for analytics data
- [x] Implement auto-refresh every 30 seconds
- [x] Added loading indicators ("...") while data loads

### Testing & Optimization
- [ ] Test with various data volumes
- [ ] Add caching for expensive queries
- [ ] Monitor query performance
- [ ] Add error tracking
- [ ] Create admin analytics view

## Quick Implementation Guide

### Step 1: Update Database Schema
Add these fields to the Job model in `schema.prisma`:
```prisma
model Job {
  // ... existing fields ...
  processingStartTime   DateTime?
  processingEndTime     DateTime?
  confidenceScores      Json?     // { "fieldName": confidenceValue }
  extractedFieldsCount  Int       @default(0)
  avgConfidence         Float?    // Average confidence across all fields
}
```

### Step 2: Create Analytics Service
Create `/server/src/services/analytics.js`:
```javascript
import prisma from '../config/database.js';

export const getDashboardAnalytics = async (userId) => {
  const now = new Date();
  const today = new Date(now.setHours(0, 0, 0, 0));
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Get jobs for calculations
  const todayJobs = await prisma.job.findMany({
    where: {
      userId,
      createdAt: { gte: today }
    }
  });
  
  const allJobs = await prisma.job.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 100 // Last 100 jobs for averages
  });
  
  // Calculate metrics
  const successRate = calculateSuccessRate(allJobs);
  const avgProcessingTime = calculateAvgProcessingTime(allJobs);
  const documentsToday = todayJobs.length;
  const accuracyScore = calculateAvgConfidence(allJobs);
  
  return {
    stats: {
      successRate: {
        value: `${successRate.toFixed(1)}%`,
        trend: '+2.3%' // TODO: Calculate actual trend
      },
      avgProcessingTime: {
        value: `${avgProcessingTime}s`,
        trend: '-3s' // TODO: Calculate actual trend
      },
      documentsToday: {
        value: documentsToday,
        trend: '+12' // TODO: Compare with yesterday
      },
      accuracyScore: {
        value: `${accuracyScore.toFixed(1)}%`,
        trend: '+0.5%' // TODO: Calculate actual trend
      }
    },
    modelPerformance: await getModelPerformance(userId)
  };
};
```

### Step 3: Create API Endpoint
Add to `/server/src/routes/api.js`:
```javascript
router.get('/dashboard/analytics', authenticateToken, async (req, res) => {
  try {
    const analytics = await getDashboardAnalytics(req.user.id);
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});
```

### Step 4: Update Frontend
In `App.jsx`, add analytics fetching:
```javascript
// Add state for analytics
const [analytics, setAnalytics] = useState(null);
const [analyticsLoading, setAnalyticsLoading] = useState(false);

// Fetch analytics
const fetchAnalytics = async () => {
  if (!user || !token) return;
  
  setAnalyticsLoading(true);
  try {
    const response = await fetchWithAuth(`${API_URL}/api/dashboard/analytics`);
    if (response.ok) {
      const data = await response.json();
      setAnalytics(data);
    }
  } catch (error) {
    console.error('Error fetching analytics:', error);
  } finally {
    setAnalyticsLoading(false);
  }
};

// Fetch on mount and refresh every 30 seconds
useEffect(() => {
  if (user && token) {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }
}, [user, token]);

// Update StatCards to use real data
<StatCard
  icon={<TrendingUp className="h-5 w-5" />}
  title="Success Rate"
  value={analyticsLoading ? '...' : analytics?.stats?.successRate?.value || '0%'}
  trend={analytics?.stats?.successRate?.trend}
  color="emerald"
/>
```