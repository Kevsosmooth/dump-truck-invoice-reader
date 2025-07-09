# Document Processing System Implementation Plan

## Overview
This document outlines the implementation plan for a robust document processing system that handles multiple PDF uploads, splits multi-page PDFs, processes them through Azure Document Intelligence, and provides renamed files in a downloadable ZIP archive.

## Azure S0 Tier Service Limits (Key Constraints)

### Rate Limits:
- **Analyze requests**: 15 per second (key constraint for processing)
- **Get operations (polling)**: 50 per second
- **Model management**: 5 per second

### Processing Limits:
- **Max file size**: 500 MB per document
- **Max pages**: 2,000 pages per analysis request
- **Polling interval**: Minimum 2 seconds between status checks
- **Retry-after header**: Respect the header value in responses

### Implementation Strategy for Rate Limits:

1. **Queue Management**:
   - Process maximum 15 documents per second
   - Implement token bucket algorithm for rate limiting
   - Queue remaining documents with exponential backoff

2. **Polling Strategy**:
   - Initial poll after 2 seconds
   - Use retry-after header if provided
   - Exponential backoff: 2, 5, 13, 34 seconds
   - Maximum 50 status checks per second across all operations

3. **Error Handling**:
   - Handle 429 (Too Many Requests) with backoff
   - Implement circuit breaker pattern
   - Store operation IDs for recovery

## Phase 1: Infrastructure Setup

### 1.1 Database Schema Updates
Add to Job model in `schema.prisma`:
```prisma
model Job {
  // ... existing fields ...
  sessionId        String?
  operationId      String?         // Azure operation ID for polling
  operationStatus  String?         // polling, succeeded, failed
  splitPageNumber  Int?            // Page number if split from multi-page PDF
  parentJobId      String?         // Reference to parent job if this is a split page
  extractedFields  Json?           // All extracted field data
  newFileName      String?         // Renamed filename based on extraction
  pollingStartedAt DateTime?       // When polling began
  lastPolledAt     DateTime?       // Last poll attempt
  blobUrl          String?         // Azure blob storage URL
  sasUrl           String?         // SAS URL for download
  sasExpiresAt     DateTime?       // SAS expiration time
}

model ProcessingSession {
  id              String           @id @default(uuid())
  userId          Int
  user            User             @relation(fields: [userId], references: [id])
  totalFiles      Int
  totalPages      Int
  processedPages  Int              @default(0)
  status          SessionStatus    @default(UPLOADING)
  blobPrefix      String           // Azure storage path prefix
  createdAt       DateTime         @default(now())
  expiresAt       DateTime         // createdAt + 24 hours
  jobs            Job[]
}

enum SessionStatus {
  UPLOADING
  PROCESSING
  COMPLETED
  FAILED
  EXPIRED
}
```

### 1.2 Environment Variables
Add to `.env`:
```
# Azure Storage
AZURE_STORAGE_ACCOUNT_NAME=your-storage-account
AZURE_STORAGE_ACCOUNT_KEY=your-storage-key
AZURE_STORAGE_CONTAINER_NAME=invoice-files

# Processing Configuration
MAX_CONCURRENT_ANALYSES=15
POLLING_INITIAL_DELAY=2000
POLLING_MAX_DELAY=34000
SESSION_EXPIRY_HOURS=24
```

## Phase 2: Core Services Implementation

### 2.1 Azure Storage Service
`server/src/services/azure-storage.js`:
- Upload files to blob storage
- Generate SAS tokens with 24-hour expiry
- Create hierarchical folder structure
- Handle blob deletion
- Implement retry logic

### 2.2 PDF Splitting Service
`server/src/services/pdf-splitter.js`:
- Use pdf-lib to split multi-page PDFs
- Preserve page quality
- Generate page thumbnails
- Return array of split pages

### 2.3 Rate Limiting Service
`server/src/services/rate-limiter.js`:
- Implement token bucket algorithm
- Track request counts
- Handle backoff logic
- Provide queue management

### 2.4 Polling Manager
`server/src/services/polling-manager.js`:
- Track active operations
- Implement exponential backoff
- Handle retry-after headers
- Support session recovery

## Phase 3: API Endpoints

### 3.1 Session Management
`/api/sessions`:
- POST `/create` - Create new processing session
- GET `/:sessionId` - Get session status
- DELETE `/:sessionId` - Cancel session

### 3.2 Upload Management
`/api/upload`:
- POST `/files` - Upload multiple files
- GET `/status/:sessionId` - Get upload progress
- POST `/process/:sessionId` - Start processing

### 3.3 Results Management
`/api/results`:
- GET `/:sessionId/status` - Get processing status
- GET `/:sessionId/download` - Download ZIP
- GET `/:sessionId/excel` - Download Excel report

## Phase 4: Processing Pipeline

### 4.1 Upload Flow
1. Create session with unique ID
2. Upload files to Azure Blob Storage
3. Split multi-page PDFs
4. Create job records for each page
5. Return session ID to client

### 4.2 Processing Flow
1. Queue jobs respecting rate limits
2. Submit to Azure Document Intelligence
3. Store operation IDs
4. Start polling for results
5. Update job status in real-time

### 4.3 Result Generation
1. Extract fields from completed operations
2. Rename files based on extracted data:
   - Format: `{CompanyName}_{TicketNumber}_{Date}.pdf`
3. Generate Excel report
4. Create ZIP archive
5. Upload to blob storage

## Phase 5: Client Implementation

### 5.1 Upload Component
- Drag & drop interface
- Multiple file selection
- Progress indicators per file
- Page count display

### 5.2 Progress Tracking
- Real-time updates via polling/WebSocket
- Session recovery from localStorage
- Estimated completion time
- Cancel operation support

### 5.3 Download Interface
- Download individual files
- Download complete ZIP
- View Excel preview
- Share session link

## Phase 6: Error Handling & Recovery

### 6.1 Connection Loss Handling
- Save session ID in localStorage
- Resume polling on reconnect
- Show connection status
- Queue retry for failed uploads

### 6.2 Operation Recovery
- Store operation IDs in database
- Resume incomplete operations
- Handle partial failures
- Provide manual retry option

### 6.3 Cleanup Process
- Scheduled job for 24-hour cleanup
- Delete blob storage files
- Archive job records
- Send expiry notifications

## Key Technical Decisions

1. **Rate Limiting**: Use p-queue library with concurrency of 15
2. **Polling**: Store operation IDs in database for recovery
3. **Storage**: Azure Blob Storage with hierarchical namespace
4. **Sessions**: 24-hour expiry with automatic cleanup
5. **Progress**: Server-Sent Events for real-time updates
6. **File Processing**: Process in batches to respect rate limits

## Extractable Fields for Renaming

Based on the Silvi_Reader_Full_2.0 model:
- Date
- Time
- Ticket #
- Customer Name
- Customer #
- Company Name
- Hauler Name
- Order #
- Delivery Address
- Tons
- Fuel Surcharge
- Materials Hauled
- Gross Weight
- Tare
- Net
- P.O #/Lot & Block
- License #
- Weight Master
- Employee

## Implementation Timeline

### Week 1
- Database schema updates
- Azure Storage service
- Basic upload endpoint

### Week 2
- PDF splitting service
- Rate limiting implementation
- Polling manager

### Week 3
- Processing pipeline
- Session management
- Progress tracking

### Week 4
- File renaming logic
- ZIP generation
- Excel report generation

### Week 5
- Client UI implementation
- Error handling
- Recovery mechanisms

### Week 6
- Testing & optimization
- Cleanup job implementation
- Documentation

## Success Criteria

1. Successfully process 100+ PDFs in a single session
2. Respect Azure rate limits without errors
3. Handle connection loss gracefully
4. Provide accurate progress tracking
5. Generate properly renamed files
6. Clean up resources after 24 hours
7. Support session recovery across browser refreshes