# Dump Truck Invoice Reader - Azure Document AI

A specialized invoice processing application that uses Microsoft Azure Document AI to extract structured data from dump truck invoices. Built with simplicity in mind using JavaScript/JSX.

## Features

- 📄 **Invoice Processing**: Extract structured data from PDF, JPEG, PNG, and TIFF files
- 🤖 **Custom AI Models**: Trained specifically for dump truck invoices
- 🔐 **Google Authentication**: Simple login with Google OAuth
- 📊 **Real-time Processing**: Immediate results without queuing
- 🎨 **Modern UI**: Built with React and Shadcn/UI
- 🚀 **Simple Mode**: Test without database setup

## Tech Stack

- **Frontend**: React + JavaScript + Vite + Shadcn/UI
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL (optional in simple mode)
- **File Storage**: Azure Blob Storage
- **AI**: Azure Document AI (Form Recognizer)
- **Auth**: Google OAuth with Passport.js

## Azure Free Tier Limitations

This application is optimized for Azure Document AI's free tier:
- Maximum 2 pages per request
- Maximum 4MB per page
- The app automatically splits multi-page PDFs into single pages for processing

## Getting Started

### Quick Start (No Database Required! 🚀)

Want to test the invoice processor immediately? Use our **Simple Mode** - no database setup needed!

#### 1. Clone and Install
```bash
git clone <repository-url>
cd invoice-processor

# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

#### 2. Configure Azure Credentials
Create a `.env` file in the `/server` directory:
```env
# Required for Simple Mode
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
AZURE_DOCUMENT_INTELLIGENCE_KEY="your-key"
AZURE_CUSTOM_MODEL_ID="your-custom-model-id" # Optional: defaults to prebuilt-invoice
```

#### 3. Start the Application
```bash
# Terminal 1 - Start backend in simple mode (no database)
cd server
npm run dev:simple

# Terminal 2 - Start frontend
cd client
npm run dev
```

That's it! Visit `http://localhost:3000` and start processing invoices! 🎉

### Full Setup (With Database)

For production use with persistent storage, user management, and all features:

#### Prerequisites
- Node.js v18+
- PostgreSQL 14+ (install locally or via Docker)
- Azure account with Document AI resource
- Azure Storage account

#### Installation Steps

1. **Install PostgreSQL**
   - Windows: Download installer from https://www.postgresql.org/download/windows/
   - Mac: `brew install postgresql`
   - Or use Docker: `docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password123 postgres:14`

2. **Create Database**
   - Using pgAdmin or command line:
   ```sql
   CREATE DATABASE invoice_processor;
   ```

3. **Configure Environment**
   Create a `.env` file in the `/server` directory:
   ```env
   # Database (update with your PostgreSQL credentials)
   DATABASE_URL="postgresql://postgres:password123@localhost:5432/invoice_processor"

   # Server
   PORT=3003
   NODE_ENV=development
   CLIENT_URL=http://localhost:5173

   # Azure Document Intelligence (REQUIRED)
   AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
   AZURE_DOCUMENT_INTELLIGENCE_KEY="your-key"
   AZURE_CUSTOM_MODEL_ID="Silvi_Reader_Full_2.0"

   # Azure Storage (REQUIRED - choose one method)
   # Method 1: Connection String (find in Azure Portal > Storage Account > Access keys)
   AZURE_STORAGE_CONNECTION_STRING="DefaultEndpointsProtocol=https;AccountName=youraccount;AccountKey=yourkey;EndpointSuffix=core.windows.net"
   
   # Method 2: Account Name + Key
   # AZURE_STORAGE_ACCOUNT_NAME="youraccount"
   # AZURE_STORAGE_ACCOUNT_KEY="yourkey"
   
   # Container name (will be created automatically)
   AZURE_STORAGE_CONTAINER_NAME="documents"

   # Authentication secrets (use random strings for local dev)
   JWT_SECRET="your-jwt-secret-here"
   SESSION_SECRET="your-session-secret-here"

   # Google OAuth (optional - for production)
   GOOGLE_CLIENT_ID="your-google-client-id"
   GOOGLE_CLIENT_SECRET="your-google-client-secret"
   GOOGLE_CALLBACK_URL="http://localhost:3003/auth/google/callback"
   ```

4. **Install Dependencies**
   ```bash
   # Install client dependencies
   cd client
   npm install

   # Install server dependencies
   cd ../server
   npm install
   ```

5. **Setup Database**
   ```bash
   cd server
   # Generate Prisma client
   npx prisma generate
   
   # Run migrations to create tables
   npx prisma migrate deploy
   ```

6. **Create Test Accounts (Optional)**
   ```bash
   # Creates test@example.com with password123 and gives mrkevinsuriel@gmail.com infinite credits
   node scripts/setup-test-account.js
   ```

7. **Start Development Servers**
   ```bash
   # Terminal 1 - Start backend (port 3003)
   cd server
   npm run dev

   # Terminal 2 - Start frontend (port 5173)
   cd client
   npm run dev
   ```

8. **Access the Application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3003

#### Finding Azure Storage Connection String
1. Log into Azure Portal (portal.azure.com)
2. Navigate to your Storage Account
3. Go to "Security + networking" → "Access keys"
4. Click "Show keys"
5. Copy the "Connection string" value from key1

## Simple Mode vs Full Mode

### Simple Mode (No Database)
Perfect for testing and development:
- ✅ No database setup required
- ✅ Runs with just Node.js
- ✅ Full Azure Document AI integration
- ✅ In-memory storage (resets on restart)
- ✅ 100 test credits included
- ❌ No data persistence
- ❌ No user management
- ❌ No background job processing

### Full Mode (With Database)
For production and multi-user scenarios:
- ✅ Persistent data storage
- ✅ User authentication with Google OAuth
- ✅ Synchronous job processing
- ✅ File storage with Azure Blob Storage
- ✅ Payment processing with Stripe (optional)
- ✅ Email notifications (optional)
- ✅ Audit trails and analytics
- ❌ Requires PostgreSQL setup

## Development

### Available Scripts

#### Backend Scripts
```bash
npm run dev          # Start with database (full mode)
npm run dev:simple   # Start without database (simple mode)
npm run build        # Build for production
npm run start        # Start production build
npm run start:simple # Start production build in simple mode
```

#### Frontend Scripts
```bash
npm run dev      # Start development server (port 5173)
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Project Structure

```
invoice-processor/
├── client/              # React frontend
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/      # Page components
│   │   ├── hooks/      # Custom hooks
│   │   ├── api/        # API client functions
│   │   └── lib/        # Utilities
│   └── package.json
├── server/              # Express backend
│   ├── src/
│   │   ├── routes/     # API routes
│   │   ├── services/   # Business logic
│   │   ├── config/     # Configuration (passport)
│   │   ├── middleware/ # Auth middleware
│   │   └── index.js    # Server entry point
│   ├── prisma/         # Database schema
│   └── package.json
├── docker/              # Docker configurations
└── docker-compose.yml   # Local development setup
```

### Key Commands

```bash
# Run tests
npm test

# Build for production
npm run build

# Run linter
npm run lint

# Format code
npm run format
```

## Deployment

### Using Docker

1. Build the Docker image:
```bash
docker build -t invoice-processor .
```

2. Run with Docker Compose:
```bash
docker-compose -f docker-compose.prod.yml up
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.