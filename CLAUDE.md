# CLAUDE.md - Development Notes

## Recent Changes (2025-07-10)

### Azure Storage Container Name Change
- Changed default container name from "training-documents" to "documents"
- This affects the Azure blob storage organization
- Update your .env file: `AZURE_STORAGE_CONTAINER_NAME=documents`

### ZIP Export Organization Update
- ZIP exports now stored under user's session folder for better security
- Path changed from `exports/session_{sessionId}_{timestamp}.zip` to `users/{userId}/sessions/{sessionId}/exports/session_{sessionId}_{timestamp}.zip`
- Provides better user isolation and consistent organization with document storage

### Azure Document Processing - Async Operations
- Azure Form Recognizer uses async operations internally with polling
- The SDK's `pollUntilDone()` method handles:
  - Submitting documents to Azure
  - Getting operation IDs
  - Polling with exponential backoff
  - Respecting Azure's Retry-After headers
- Created `document-processor-simple.js` for concurrent processing without Redis/Bull:
  - Processes up to 5 documents concurrently
  - Implements rate limiting (15 req/sec for S0 tier)
  - Provides progress callbacks
  - Supports batch processing for large document sets
- The UI polls our backend every 2 seconds to check overall session progress

## Recent Changes (2025-07-10)

### Critical Fixes Applied
- **Fixed ES Module Import/Export Issues**
  - Converted all CommonJS `module.exports` to ES module `export` statements
  - Updated all `require()` statements to `import` statements
  - Created missing `azure.js` config file
  - Services now properly use ES module syntax throughout

- **Resolved Session Model Schema Conflict**
  - Removed `status` field from authentication Session model
  - Fixed confusion between auth sessions and processing sessions
  - Authentication sessions now only track: id, userId, token, expiresAt, createdAt
  - ProcessingSession model handles document processing with status tracking

- **Database Schema Reset**
  - Used `npx prisma migrate reset --force` to rebuild database
  - All models now properly synchronized with database
  - Google OAuth authentication now working correctly

### What to Expect When Uploading PDFs

When you upload 2 PDF files, here's the expected flow:

1. **File Selection**
   - Drag & drop or click to select multiple PDFs
   - Confirmation modal shows:
     - Total pages per PDF
     - Credits to be used (1 credit per page)
     - Model being used (Silvi_Reader_Full_2.0)
     - Fields that will be extracted

2. **Processing Session Created**
   - A unique session ID is generated
   - Files are uploaded to Azure Blob Storage
   - Multi-page PDFs are automatically split into individual pages
   - Each page becomes a separate job in the system

3. **Rate-Limited Processing**
   - Documents are processed at max 15 per second (Azure S0 tier limit)
   - Progress bar shows X/Y documents completed
   - Estimated time remaining displayed
   - Session is saved to localStorage for recovery

4. **Real-time Status Updates**
   - Each document shows status: uploading → processing → completed/failed
   - Polling manager checks Azure operation status
   - Failed documents can be retried

5. **Results Available**
   - Completed session shows download button
   - ZIP file contains:
     - All PDFs renamed as: CompanyName_TicketNumber_Date.pdf
     - Excel report with all extracted data
   - Individual files can also be downloaded
   - Results available for 24 hours

6. **Automatic Cleanup**
   - After 24 hours, files are automatically deleted
   - Session marked as expired
   - Cleanup service runs periodically

### Current Limitations
- Azure Storage credentials need to be configured in .env
- Maximum 500MB per file (Azure limit)
- Maximum 2000 pages per document (Azure limit)

## Recent Changes (2025-07-09)

### Session-Based Processing and Multi-File Upload
Implemented session-based document processing with support for multi-file uploads, including ZIP file extraction.

**New Features:**
- **Session-based processing**
  - Each upload creates a new session with unique ID
  - Sessions track multiple files and their processing status
  - 24-hour file retention policy with automatic cleanup
  - Sessions stored in PostgreSQL database
  
- **Multi-file upload support**
  - Users can upload multiple PDFs at once
  - ZIP file support with automatic extraction
  - Progress tracking for each file in the session
  - Batch download of processed results as ZIP
  
- **File naming convention**
  - Enforced format: `CompanyName_TicketNumber_Date.pdf`
  - Automatic parsing of company name, ticket number, and date
  - Validation ensures proper naming before processing

### New Services Created
- **pdf-splitter**: Splits multi-page PDFs into individual pages for processing
- **rate-limiter**: Manages Azure API rate limits (15 req/sec for S0 tier)
- **polling-manager**: Handles concurrent polling of Azure processing status
- **zip-generator**: Creates ZIP files for batch downloads

### New API Endpoints
```javascript
// Session endpoints
POST   /api/sessions                 // Create new session
GET    /api/sessions/:sessionId      // Get session details
POST   /api/sessions/:sessionId/upload // Upload files to session
POST   /api/sessions/:sessionId/process // Start processing session
GET    /api/sessions/:sessionId/download // Download all results as ZIP
DELETE /api/sessions/:sessionId      // Delete session and files

// File endpoints
GET    /api/files/:fileId/download   // Download individual file
DELETE /api/files/:fileId            // Delete individual file
```

### Database Schema Changes
```prisma
model Session {
  id          String   @id @default(cuid())
  userId      String?
  status      String   @default("pending")
  totalFiles  Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  files       File[]
  user        User?    @relation(fields: [userId], references: [id])
}

model File {
  id             String   @id @default(cuid())
  sessionId      String
  originalName   String
  storedName     String
  companyName    String?
  ticketNumber   String?
  date           DateTime?
  pageCount      Int      @default(1)
  status         String   @default("pending")
  processingUrl  String?
  resultUrl      String?
  extractedData  Json?
  error          String?
  createdAt      DateTime @default(now())
  session        Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}
```

### Azure S0 Tier Rate Limits
- **15 requests per second** maximum
- Rate limiter implements exponential backoff
- Concurrent processing limited to 10 files
- Polling intervals adjusted to respect limits

### Required Environment Variables
```env
# Azure Document Intelligence (Required)
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
AZURE_DOCUMENT_INTELLIGENCE_KEY="your-key"

# Database (Required for full mode)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/invoice_processor"

# Authentication (Required for full mode)
SESSION_SECRET="your-session-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
JWT_SECRET="your-jwt-secret"

# File Storage (Optional - defaults shown)
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE="10485760"  # 10MB in bytes
ALLOWED_EXTENSIONS=".pdf,.zip"

# Rate Limiting (Optional - defaults shown)
AZURE_RATE_LIMIT="15"     # requests per second
AZURE_BURST_LIMIT="20"    # burst capacity
POLLING_INTERVAL="2000"   # milliseconds
MAX_CONCURRENT="10"       # concurrent operations

# Session Settings (Optional - defaults shown)
SESSION_TIMEOUT="86400000"  # 24 hours in milliseconds
CLEANUP_INTERVAL="3600000"  # 1 hour in milliseconds
```

### Document Processing Confirmation Modal
Implemented a confirmation modal to prevent accidental credit loss when processing documents.

**Features added:**
- **Confirmation modal** before processing documents
  - Shows list of files with page counts
  - Displays total pages and credits to be used
  - Prevents processing if insufficient credits
  - PDF page counting using client-side parsing

- **Azure Model Field Detection**
  - Direct API integration with Azure Form Recognizer
  - Endpoint: `GET /formrecognizer/documentModels/{modelId}?api-version=2023-07-31`
  - Shows exact fields that will be extracted before processing
  - Created `/api/models/:modelId/info` endpoint

- **UI/UX Improvements**
  - Only PDF uploads allowed (temporarily removed image support)
  - Fixed select dropdown transparency issue
  - Improved modal styling with scrollable sections
  - Removed all "AI" terminology from the interface

**Technical implementation:**
```javascript
// Client-side PDF page counting
const countPDFPages = async (file) => {
  // Parses PDF structure to count /Type /Page markers
}

// Server-side Azure API call
const apiUrl = `${endpoint}/formrecognizer/documentModels/${modelId}?api-version=2023-07-31`;
const response = await axios.get(apiUrl, {
  headers: { 'Ocp-Apim-Subscription-Key': apiKey }
});
```

## Recent Changes (2025-07-09)

### TypeScript to JavaScript Migration
The entire codebase has been migrated from TypeScript to JavaScript/JSX to simplify development and reduce strict type checking issues.

**Client-side changes:**
- Converted all `.tsx` files to `.jsx` (React components)
- Converted all `.ts` files to `.js` (utilities, hooks)
- Removed TypeScript configuration files (`tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`)
- Updated Vite configuration to JavaScript
- Updated ESLint configuration for JavaScript

**Server-side changes:**
- Converted all `.ts` files to `.js`
- Updated package.json to use ES modules (`"type": "module"`)
- Changed all scripts from `ts-node` to `node`
- Updated nodemon to watch `.js` files

### Redis and Bull Queue Removal
Removed Redis and Bull queues as they were not being used for notifications or email processing.

**Changes made:**
- Removed Redis connection from server startup
- Removed Bull queue imports and initialization
- Jobs are now processed synchronously when uploaded
- Sessions are stored in PostgreSQL (not Redis)

### Authentication Implementation
Implemented Google OAuth and session-based authentication:

**Backend:**
- Auth routes mounted at `/auth` (not `/api/auth`)
- Google OAuth with Passport.js
- Sessions stored in PostgreSQL
- JWT tokens for session management

**Frontend:**
- Token stored in localStorage
- AuthContext manages user state
- Protected routes with PrivateRoute component
- Auth callback handles Google OAuth redirect

### Current Ports
- Frontend: `http://localhost:5173` (Vite default)
- Backend: `http://localhost:3003` (changed from 3001)

## Project Structure

### Running the Application

**Development mode with database:**
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

**Simple mode without database:**
```bash
# Terminal 1 - Backend
cd server
npm run dev:simple

# Terminal 2 - Frontend
cd client
npm run dev
```

### Key Files

**Authentication Flow:**
- `/server/src/routes/auth.js` - Auth endpoints
- `/server/src/config/passport.js` - Google OAuth strategy
- `/client/src/contexts/AuthContext.jsx` - Client auth state
- `/client/src/pages/Login.jsx` - Login page
- `/client/src/pages/AuthCallback.jsx` - OAuth callback handler

**Main Application:**
- `/server/src/index.js` - Main server (with database)
- `/server/src/index-simple.js` - Simple server (no database)
- `/client/src/App.jsx` - Main React app
- `/client/src/main.jsx` - React entry point with routing

### Environment Variables

Required for both modes:
```env
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
AZURE_DOCUMENT_INTELLIGENCE_KEY="your-key"
```

Additional for full mode:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/invoice_processor"
SESSION_SECRET="your-session-secret"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

### Recent Issues Resolved

1. **TypeScript Strictness**: Migrated to JavaScript to avoid strict type checking
2. **Missing return statements**: Fixed async route handlers to always return responses
3. **Redis dependency**: Removed Redis/Bull queues for simpler deployment
4. **Auth routing**: Fixed route mounting to match frontend expectations
5. **Token storage**: Implemented localStorage for JWT token persistence

### Testing Authentication

1. Navigate to `http://localhost:5173`
2. Click "Continue with Google"
3. Complete OAuth flow
4. Token stored in localStorage
5. Redirected to main app

### Notes for Future Development

- Email notifications can be implemented without queues using direct API calls
- Consider adding a simple in-memory queue if background processing is needed
- Database sessions could be replaced with JWT-only auth for stateless operation
- Add rate limiting for API endpoints
- Implement proper error boundaries in React components