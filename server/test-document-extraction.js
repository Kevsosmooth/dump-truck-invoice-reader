import * as dotenv from 'dotenv';
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import fs from 'fs';
import path from 'path';

dotenv.config();

const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
const modelId = process.env.AZURE_CUSTOM_MODEL_ID || 'Silvi_Reader_Full_2.0';

const client = new DocumentAnalysisClient(endpoint, new AzureKeyCredential(apiKey));

async function testDocumentExtraction(pdfPath) {
  try {
    console.log('Testing document extraction');
    console.log('Model:', modelId);
    console.log('PDF Path:', pdfPath);
    console.log('');
    
    // Check if file exists
    if (!fs.existsSync(pdfPath)) {
      console.error('❌ PDF file not found:', pdfPath);
      return;
    }
    
    // Read the PDF file
    const fileBuffer = fs.readFileSync(pdfPath);
    console.log('✅ PDF loaded, size:', fileBuffer.length, 'bytes');
    
    // Start analysis
    console.log('\nStarting document analysis...');
    const poller = await client.beginAnalyzeDocument(modelId, fileBuffer);
    const result = await poller.pollUntilDone();
    
    if (!result || !result.documents || result.documents.length === 0) {
      console.error('❌ No documents found in the result');
      return;
    }
    
    const document = result.documents[0];
    const fields = document.fields || {};
    
    console.log('\n✅ Document analyzed successfully!');
    console.log('Document Type detected:', document.docType);
    console.log('Confidence:', document.confidence);
    console.log('Number of fields extracted:', Object.keys(fields).length);
    
    // Check specific fields
    console.log('\nField Extraction Results:');
    console.log('─'.repeat(80));
    
    const importantFields = [
      'Company Name',
      'Ticket #',
      'Date',
      'Customer Name',
      'Delivery Address',
      'Billing Address',
      'Tons',
      'Materials Hauled'
    ];
    
    importantFields.forEach(fieldName => {
      const field = fields[fieldName];
      if (field) {
        console.log(`✅ ${fieldName}:`, field.value || field.content || '[extracted but empty]');
        console.log(`   Confidence: ${field.confidence}`);
      } else {
        console.log(`❌ ${fieldName}: NOT EXTRACTED`);
      }
    });
    
    // Show all extracted fields
    console.log('\nAll Extracted Fields:');
    console.log('─'.repeat(80));
    Object.entries(fields).sort().forEach(([fieldName, field]) => {
      const value = field.value || field.content || field.valueString || '[complex value]';
      console.log(`• ${fieldName}: ${value} (confidence: ${field.confidence})`);
    });
    
    // Check which document type was matched
    console.log('\nDocument Type Analysis:');
    console.log('─'.repeat(80));
    console.log('Detected document type:', document.docType);
    
    if (document.docType === 'Silvi_Brick_Reader') {
      console.log('⚠️  This document was classified as Silvi_Brick_Reader');
      console.log('   This document type does NOT include Billing Address field');
    } else if (document.docType === 'Silvi_Reader_Eagles_Lake' || document.docType === 'Silvi_Reader_South_Hampton') {
      console.log('✅ This document was classified as', document.docType);
      console.log('   This document type SHOULD include Billing Address field');
      
      if (!fields['Billing Address']) {
        console.log('   ⚠️  However, Billing Address was not extracted from this document');
        console.log('   Possible reasons:');
        console.log('   - The field might be empty or unclear in the PDF');
        console.log('   - The model might need more training data for this field');
      }
    }
    
    // Save results for inspection
    const outputPath = path.join(path.dirname(pdfPath), 'extraction-results.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      modelId,
      documentType: document.docType,
      confidence: document.confidence,
      fields: fields,
      fieldNames: Object.keys(fields).sort(),
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`\n💾 Full results saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}

// Get PDF path from command line or use default
const pdfPath = process.argv[2];

if (!pdfPath) {
  console.log('Usage: node test-document-extraction.js <path-to-pdf>');
  console.log('Example: node test-document-extraction.js ../test-documents/sample-invoice.pdf');
} else {
  testDocumentExtraction(pdfPath);
}