import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFViewerProps {
  url: string;
  pageNumber?: number;
  scale?: number;
  onLoadSuccess?: (numPages: number) => void;
}

export function PDFViewer({ url, pageNumber = 1, scale = 1, onLoadSuccess }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  console.log('PDFViewer: Attempting to load PDF from:', url);

  function handleLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setError(null);
    setLoading(false);
    onLoadSuccess?.(numPages);
  }

  function handleLoadError(error: Error) {
    console.error('PDF load error:', error);
    console.error('Error details:', error.message, error.stack);
    setError(`Failed to load PDF: ${error.message}`);
    setLoading(false);
  }

  // Remove the PDF check since we're serving PDFs from API endpoints

  return (
    <div className="pdf-viewer w-full h-full flex items-center justify-center">
      {loading && (
        <div className="text-center text-gray-500 py-4">Loading PDF...</div>
      )}
      {error ? (
        <div className="text-center text-red-500 py-4">{error}</div>
      ) : (
        <Document
          file={url}
          onLoadSuccess={handleLoadSuccess}
          onLoadError={handleLoadError}
          loading={null}
        >
          <Page 
            pageNumber={pageNumber} 
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-lg"
          />
        </Document>
      )}
      {numPages && numPages > 1 && (
        <p className="text-xs text-gray-500 text-center mt-2 absolute bottom-2">
          Page {pageNumber} of {numPages}
        </p>
      )}
    </div>
  );
}