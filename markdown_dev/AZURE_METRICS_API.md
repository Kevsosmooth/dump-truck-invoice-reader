# Azure Metrics API Documentation

## Overview
Since Azure Monitor API requires complex authentication with Azure AD, we've created a simplified endpoint to track document processing metrics.

## Available Endpoints

### 1. Get Processed Pages Metrics (Mock)
**Endpoint:** `GET /api/metrics/processed-pages`  
**Authentication:** Required (JWT token)

Returns mock data simulating Azure Monitor metrics for processed pages this month.

**Response:**
```json
{
  "success": true,
  "metrics": {
    "timespan": "2025-07-01T00:00:00.000Z/2025-07-11T22:00:00.000Z",
    "metricName": "ProcessedPages",
    "aggregation": "Total",
    "unit": "Count"
  },
  "summary": {
    "totalProcessedPages": 154,
    "period": {
      "start": "2025-07-01T00:00:00.000Z",
      "end": "2025-07-11T22:00:00.000Z"
    },
    "dailyAverage": 14
  }
}
```

### 2. Get Local Database Metrics
**Endpoint:** `GET /api/metrics/processed-pages/local`  
**Authentication:** Required (JWT token)

Returns actual processed pages count from your local database.

**Query Parameters:**
- `startDate` (optional): ISO date string (defaults to first day of current month)
- `endDate` (optional): ISO date string (defaults to current date)

**Response:**
```json
{
  "success": true,
  "count": 42,
  "period": {
    "start": "2025-07-01T00:00:00.000Z",
    "end": "2025-07-11T22:00:00.000Z"
  },
  "source": "database"
}
```

## Implementation Notes

### Current Implementation (Mock)
The `/api/metrics/processed-pages` endpoint currently returns mock data (154 pages) to simulate what the Azure Monitor API would return.

### Future Azure Monitor Integration
To integrate with actual Azure Monitor API, you would need:

1. **Azure AD App Registration**
   - Create an app registration in Azure AD
   - Grant it "Monitoring Reader" permissions
   - Get client ID, tenant ID, and client secret

2. **Environment Variables**
   ```env
   AZURE_SUBSCRIPTION_ID=your-subscription-id
   AZURE_RESOURCE_GROUP=555
   AZURE_TENANT_ID=your-tenant-id
   AZURE_CLIENT_ID=your-client-id
   AZURE_CLIENT_SECRET=your-client-secret
   ```

3. **Implementation Steps**
   ```javascript
   // 1. Get access token from Azure AD
   const tokenResponse = await axios.post(
     `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
     new URLSearchParams({
       'client_id': clientId,
       'client_secret': clientSecret,
       'scope': 'https://management.azure.com/.default',
       'grant_type': 'client_credentials'
     })
   );

   // 2. Call Azure Monitor API
   const metricsResponse = await axios.get(
     `https://management.azure.com/subscriptions/${subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.CognitiveServices/accounts/silvi/providers/microsoft.insights/metrics`,
     {
       params: {
         'api-version': '2024-02-01',
         'metricnames': 'ProcessedPages',
         'timespan': `${startDate}/${endDate}`,
         'aggregation': 'Total'
       },
       headers: {
         'Authorization': `Bearer ${tokenResponse.data.access_token}`
       }
     }
   );
   ```

### Alternative: Use Azure CLI Programmatically
You could also execute Azure CLI commands from Node.js:

```javascript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const { stdout } = await execAsync(`
  az monitor metrics list \
    --resource /subscriptions/${subscriptionId}/resourceGroups/555/providers/Microsoft.CognitiveServices/accounts/silvi \
    --metric ProcessedPages \
    --start-time ${startDate} \
    --end-time ${endDate} \
    --aggregation Total
`);

const metrics = JSON.parse(stdout);
```

## Usage Examples

### JavaScript/Fetch
```javascript
// Get mock metrics
const response = await fetch('/api/metrics/processed-pages', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const data = await response.json();
console.log(`Total pages processed: ${data.summary.totalProcessedPages}`);

// Get local database metrics
const localResponse = await fetch('/api/metrics/processed-pages/local', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
const localData = await localResponse.json();
console.log(`Pages in database: ${localData.count}`);
```

### cURL
```bash
# Get mock metrics
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3003/api/metrics/processed-pages

# Get local metrics for specific date range
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:3003/api/metrics/processed-pages/local?startDate=2025-07-01&endDate=2025-07-11"
```

## Notes
- The mock endpoint always returns 154 as the total (based on your actual Azure metrics)
- The local endpoint queries your PostgreSQL database for completed jobs
- Both endpoints require authentication
- Consider caching results to avoid excessive API calls