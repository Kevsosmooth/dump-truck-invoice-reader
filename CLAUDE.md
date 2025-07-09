# CLAUDE.md - Development Notes

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