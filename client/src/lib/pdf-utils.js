// Simple PDF page counter that reads the PDF structure
export async function countPDFPages(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = function(e) {
      try {
        const data = new Uint8Array(e.target.result);
        let pageCount = 0;
        
        // Convert to string to search for page markers
        const pdfContent = new TextDecoder('latin1').decode(data);
        
        // Count occurrences of "/Type /Page" (not "/Pages")
        const pageMatches = pdfContent.match(/\/Type\s*\/Page(?![s])/g);
        if (pageMatches) {
          pageCount = pageMatches.length;
        }
        
        // If no pages found with first method, try counting page objects
        if (pageCount === 0) {
          // Look for obj markers that define pages
          const objMatches = pdfContent.match(/\d+\s+0\s+obj[\s\S]*?\/Type\s*\/Page(?![s])[\s\S]*?endobj/g);
          if (objMatches) {
            pageCount = objMatches.length;
          }
        }
        
        // Fallback: at least 1 page
        resolve(Math.max(1, pageCount));
      } catch (error) {
        console.error('Error counting PDF pages:', error);
        // Default to 1 page on error
        resolve(1);
      }
    };
    
    reader.onerror = () => {
      console.error('Error reading file');
      resolve(1);
    };
    
    reader.readAsArrayBuffer(file);
  });
}