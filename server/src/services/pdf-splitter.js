import { PDFDocument } from 'pdf-lib';

/**
 * Splits a multi-page PDF into individual page buffers
 * @param {Buffer} pdfBuffer - The input PDF buffer
 * @returns {Promise<Buffer[]>} Array of individual page buffers
 */
export async function splitPDF(pdfBuffer) {
  try {
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    if (pageCount === 0) {
      throw new Error('PDF has no pages');
    }
    
    const pageBuffers = [];
    
    // Extract each page into a separate PDF
    for (let i = 0; i < pageCount; i++) {
      // Create a new PDF document for this page
      const newPdfDoc = await PDFDocument.create();
      
      // Copy the page from the original document
      const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [i]);
      newPdfDoc.addPage(copiedPage);
      
      // Save the single-page PDF as a buffer
      const pdfBytes = await newPdfDoc.save();
      pageBuffers.push(Buffer.from(pdfBytes));
    }
    
    return pageBuffers;
  } catch (error) {
    console.error('Error splitting PDF:', error);
    throw new Error(`Failed to split PDF: ${error.message}`);
  }
}

/**
 * Counts the number of pages in a PDF
 * @param {Buffer} pdfBuffer - The input PDF buffer
 * @returns {Promise<number>} Number of pages in the PDF
 */
export async function countPages(pdfBuffer) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    return pdfDoc.getPageCount();
  } catch (error) {
    console.error('Error counting PDF pages:', error);
    throw new Error(`Failed to count PDF pages: ${error.message}`);
  }
}

/**
 * Extracts a specific page from a PDF
 * @param {Buffer} pdfBuffer - The input PDF buffer
 * @param {number} pageNumber - The page number to extract (1-indexed)
 * @returns {Promise<Buffer>} Buffer containing the extracted page
 */
export async function extractPage(pdfBuffer, pageNumber) {
  try {
    if (pageNumber < 1) {
      throw new Error('Page number must be 1 or greater');
    }
    
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    if (pageNumber > pageCount) {
      throw new Error(`Page ${pageNumber} does not exist. PDF has ${pageCount} pages`);
    }
    
    // Create a new PDF with just the requested page
    const newPdfDoc = await PDFDocument.create();
    
    // Copy the page (convert to 0-indexed)
    const [copiedPage] = await newPdfDoc.copyPages(pdfDoc, [pageNumber - 1]);
    newPdfDoc.addPage(copiedPage);
    
    // Save as buffer
    const pdfBytes = await newPdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error extracting PDF page:', error);
    throw new Error(`Failed to extract PDF page: ${error.message}`);
  }
}

/**
 * Generates thumbnail data for PDF pages (returns page dimensions and metadata)
 * @param {Buffer} pdfBuffer - The input PDF buffer
 * @returns {Promise<Array>} Array of page metadata including dimensions
 */
export async function generatePageMetadata(pdfBuffer) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    const metadata = [];
    
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      const rotation = page.getRotation().angle;
      
      metadata.push({
        pageNumber: i + 1,
        width,
        height,
        rotation,
        aspectRatio: width / height
      });
    }
    
    return metadata;
  } catch (error) {
    console.error('Error generating page metadata:', error);
    throw new Error(`Failed to generate page metadata: ${error.message}`);
  }
}

/**
 * Extracts a range of pages from a PDF
 * @param {Buffer} pdfBuffer - The input PDF buffer
 * @param {number} startPage - Starting page number (1-indexed)
 * @param {number} endPage - Ending page number (1-indexed, inclusive)
 * @returns {Promise<Buffer>} Buffer containing the extracted pages
 */
export async function extractPageRange(pdfBuffer, startPage, endPage) {
  try {
    if (startPage < 1 || endPage < 1) {
      throw new Error('Page numbers must be 1 or greater');
    }
    
    if (startPage > endPage) {
      throw new Error('Start page must be less than or equal to end page');
    }
    
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    if (endPage > pageCount) {
      throw new Error(`End page ${endPage} exceeds total pages (${pageCount})`);
    }
    
    // Create a new PDF with the page range
    const newPdfDoc = await PDFDocument.create();
    
    // Generate array of page indices to copy (convert to 0-indexed)
    const pageIndices = [];
    for (let i = startPage - 1; i < endPage; i++) {
      pageIndices.push(i);
    }
    
    // Copy all pages in the range
    const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
    copiedPages.forEach(page => newPdfDoc.addPage(page));
    
    // Save as buffer
    const pdfBytes = await newPdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('Error extracting page range:', error);
    throw new Error(`Failed to extract page range: ${error.message}`);
  }
}

/**
 * Validates if a buffer is a valid PDF
 * @param {Buffer} buffer - The buffer to validate
 * @returns {Promise<boolean>} True if valid PDF, false otherwise
 */
export async function isValidPDF(buffer) {
  try {
    await PDFDocument.load(buffer);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Gets comprehensive PDF information
 * @param {Buffer} pdfBuffer - The input PDF buffer
 * @returns {Promise<Object>} PDF information including page count, title, author, etc.
 */
export async function getPDFInfo(pdfBuffer) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    
    // Get document metadata
    const title = pdfDoc.getTitle() || null;
    const author = pdfDoc.getAuthor() || null;
    const subject = pdfDoc.getSubject() || null;
    const creator = pdfDoc.getCreator() || null;
    const producer = pdfDoc.getProducer() || null;
    const creationDate = pdfDoc.getCreationDate();
    const modificationDate = pdfDoc.getModificationDate();
    
    // Get page information
    const pages = [];
    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const { width, height } = page.getSize();
      pages.push({
        pageNumber: i + 1,
        width,
        height,
        rotation: page.getRotation().angle
      });
    }
    
    return {
      pageCount,
      title,
      author,
      subject,
      creator,
      producer,
      creationDate,
      modificationDate,
      pages,
      fileSize: pdfBuffer.length
    };
  } catch (error) {
    console.error('Error getting PDF info:', error);
    throw new Error(`Failed to get PDF info: ${error.message}`);
  }
}

// Default export object containing all functions
export default {
  splitPDF,
  countPages,
  extractPage,
  generatePageMetadata,
  extractPageRange,
  isValidPDF,
  getPDFInfo
};