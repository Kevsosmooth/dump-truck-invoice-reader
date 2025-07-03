# Invoice Processor - Azure Document AI

A multi-tenant invoice processing SaaS application that uses Microsoft Azure Document AI to extract structured data from invoices. Optimized for Azure's free tier with support for custom models.

## Features

- 📄 **Invoice Processing**: Extract structured data from PDF, JPEG, PNG, and TIFF files
- 🤖 **Custom AI Models**: Support for tenant-specific custom models
- 💳 **Credit System**: Pay-per-page processing with Stripe integration
- 🔒 **Secure**: Azure AD B2C authentication with social logins
- 📊 **Real-time Updates**: Live processing status with TanStack Query
- 🎨 **Modern UI**: Built with React, TypeScript, and Shadcn/UI
- 🐳 **Docker Ready**: Easy development and deployment with Docker Compose

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Shadcn/UI + TanStack Query
- **Backend**: Node.js + Express + Prisma ORM
- **Database**: PostgreSQL
- **Queue**: Redis + Bull
- **File Storage**: Azure Blob Storage
- **AI**: Azure Document AI (Form Recognizer)
- **Auth**: Azure AD B2C
- **Payments**: Stripe
- **Email**: SendGrid/Resend

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
- Docker and Docker Compose
- Azure account with Document AI resource
- PostgreSQL (via Docker)
- Redis (via Docker)

#### Complete Environment Variables
Create a `.env` file in the `/server` directory:
```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/invoice_processor"
REDIS_URL="redis://localhost:6379"

# Azure Document Intelligence
AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
AZURE_DOCUMENT_INTELLIGENCE_KEY="your-key"
AZURE_CUSTOM_MODEL_ID="your-custom-model-id"

# Azure Storage
AZURE_STORAGE_CONNECTION_STRING="your-connection-string"
AZURE_STORAGE_CONTAINER_NAME="invoice-files"

# Authentication (optional)
JWT_SECRET="your-jwt-secret"

# Email (optional)
SENDGRID_API_KEY="SG...."
FROM_EMAIL="noreply@yourdomain.com"

# Payments (optional)
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
```

#### Installation Steps
1. Start Docker services:
```bash
docker-compose up -d
```

2. Run database migrations:
```bash
cd server
npx prisma migrate dev
```

3. Start development servers:
```bash
# Terminal 1 - Start backend with database
cd server
npm run dev

# Terminal 2 - Start frontend
cd client
npm run dev
```

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
- ✅ User authentication with Azure AD B2C
- ✅ Background job processing with Redis/Bull
- ✅ File storage with Azure Blob Storage
- ✅ Payment processing with Stripe
- ✅ Email notifications
- ✅ Audit trails and analytics
- ❌ Requires Docker and database setup

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
npm run dev      # Start development server (port 3000)
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
│   │   ├── jobs/       # Bull job processors
│   │   └── index.ts    # Server entry point
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