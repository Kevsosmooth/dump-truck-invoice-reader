# Invoice AI Pro - Client Application

A modern, professional invoice processing application built with React, TypeScript, and Azure Document Intelligence. Features a beautiful UI with drag-and-drop functionality, real-time processing status, and credit-based billing.

![Invoice AI Pro](https://img.shields.io/badge/Invoice%20AI%20Pro-v1.0.0-blue)
![React](https://img.shields.io/badge/React-19.1.0-61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-3178c6)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.4.17-06b6d4)

## 🚀 Features

### Core Functionality
- **Drag & Drop Upload**: Intuitive file upload with visual feedback
- **Multi-Format Support**: Process PDF, JPEG, PNG, and TIFF invoices
- **Real-Time Processing**: Live status updates with progress tracking
- **Smart Data Extraction**: AI-powered extraction of invoice details
- **Credit System**: Pay-per-page processing with transparent pricing

### UI/UX Highlights
- 🎨 **Modern Design**: Gradient backgrounds with animated blob effects
- ✨ **Smooth Animations**: Hover effects and transitions throughout
- 📊 **Statistics Dashboard**: KPI cards showing success rate, processing time, and accuracy
- 🔔 **Status Indicators**: Clear visual feedback for job processing states
- 📱 **Fully Responsive**: Works seamlessly on desktop and mobile devices

### Technical Features
- **TypeScript**: Full type safety across the application
- **TanStack Query**: Efficient server state management with caching
- **Shadcn/UI**: Beautiful, accessible component library
- **Tailwind CSS**: Utility-first styling with custom gradients
- **Vite**: Lightning-fast development and build times

## 📸 Screenshots

### Main Dashboard
- Upload area with drag-and-drop functionality
- Recent processing jobs with status indicators
- Credit balance and usage statistics
- Quick action buttons

### Processing States
- **Queued**: Yellow indicator with clock icon
- **Processing**: Blue indicator with spinning loader
- **Completed**: Green indicator with checkmark
- **Failed**: Red indicator with error message

## 🛠️ Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd invoice-processor/client
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the client directory:
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## 🧱 Project Structure

```
client/
├── src/
│   ├── components/
│   │   └── ui/           # Shadcn/UI components
│   ├── hooks/            # Custom React hooks
│   │   ├── use-auth.ts   # Authentication context
│   │   ├── use-jobs.ts   # Job processing hooks
│   │   └── use-credits.ts # Credit balance hooks
│   ├── lib/              # Utilities and configurations
│   │   ├── api.ts        # Axios API client
│   │   ├── query-client.ts # TanStack Query setup
│   │   └── utils.ts      # Helper functions
│   ├── App.tsx           # Main application component
│   ├── main.tsx          # Application entry point
│   └── index.css         # Global styles (Tailwind)
├── public/               # Static assets
├── package.json          # Dependencies and scripts
└── vite.config.ts        # Vite configuration
```

## 🎯 Usage Guide

### Uploading Invoices
1. Drag and drop your invoice file onto the upload area
2. Or click "Select Invoice" to browse files
3. Supported formats: PDF, JPEG, PNG, TIFF
4. Maximum file size: 4MB per page (free tier)

### Processing Limits
- **Free Tier**: 2 pages maximum per document
- **File Size**: 4MB per page
- **Multi-page PDFs**: Automatically split for processing

### Viewing Results
- Check the "Recent Processing Activity" section
- Completed jobs show extracted invoice amounts
- Click the download button to get processed files
- Failed jobs display error messages for troubleshooting

## 🚦 Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint

# Type checking
npm run type-check
```

## 🎨 Customization

### Theme Colors
The application uses a professional color palette:
- **Primary**: Indigo to Purple gradients
- **Success**: Emerald/Teal
- **Info**: Blue
- **Warning**: Yellow
- **Error**: Red

### Modifying Styles
1. Global styles: Edit `src/index.css`
2. Component styles: Use Tailwind classes in components
3. Theme configuration: Update `tailwind.config.js`

## 🔧 Configuration

### API Endpoint
Update the API URL in `.env`:
```env
VITE_API_URL=https://your-api-endpoint.com
```

### Port Configuration
Default port is 3000. To change:
```json
// package.json
"scripts": {
  "dev": "vite --port 5000"
}
```

## 📦 Dependencies

### Core Dependencies
- **React 19.1.0**: UI framework
- **TypeScript 5.8.3**: Type safety
- **Vite 7.0.0**: Build tool
- **TanStack Query 5.81.5**: Server state management
- **Axios 1.10.0**: HTTP client

### UI Libraries
- **Shadcn/UI**: Component library
- **Tailwind CSS 3.4.17**: Utility-first CSS
- **Lucide React 0.525.0**: Icon library
- **clsx & tailwind-merge**: Utility functions

## 🐛 Troubleshooting

### Icons Not Displaying
- Ensure Lucide React is installed
- Clear browser cache (Ctrl+Shift+R)
- Check browser console for errors

### Styling Issues
- Verify Tailwind CSS is configured correctly
- Check PostCSS configuration
- Ensure `index.css` imports Tailwind directives

### API Connection Issues
- Verify backend is running on correct port
- Check CORS configuration
- Ensure environment variables are set

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- [Shadcn/UI](https://ui.shadcn.com/) for the beautiful component library
- [Lucide](https://lucide.dev/) for the icon set
- [TanStack Query](https://tanstack.com/query) for state management
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework

---

Built with ❤️ using React, TypeScript, and Azure Document Intelligence