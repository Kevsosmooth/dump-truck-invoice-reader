import { PDFDocument } from 'pdf-lib';

export async function splitPdfPages(pdfBuffer: Buffer): Promise<Buffer[]> {
  try {
    // Load the PDF
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    console.log(`Splitting PDF with ${pageCount} pages...`);
    
    // If it's a single page, just return the original
    if (pageCount === 1) {
      return [pdfBuffer];
    }
    
    // Split into individual pages
    const pageBuffers: Buffer[] = [];
    
    for (let i = 0; i < pageCount; i++) {
      // Create a new PDF with just this page
      const newPdf = await PDFDocument.create();
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [i]);
      newPdf.addPage(copiedPage);
      
      // Convert to buffer
      const pdfBytes = await newPdf.save();
      pageBuffers.push(Buffer.from(pdfBytes));
      
      console.log(`Split page ${i + 1}/${pageCount}`);
    }
    
    return pageBuffers;
  } catch (error) {
    console.error('Error splitting PDF:', error);
    throw new Error('Failed to split PDF document');
  }
}

export function isPdf(buffer: Buffer): boolean {
  // Check if the buffer starts with PDF magic number
  return buffer.length > 4 && buffer.toString('utf8', 0, 4) === '%PDF';
}