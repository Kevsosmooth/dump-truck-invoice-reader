import * as dotenv from 'dotenv';
import { DocumentModelAdministrationClient, AzureKeyCredential } from '@azure/ai-form-recognizer';

dotenv.config();

const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
const modelId = process.env.AZURE_CUSTOM_MODEL_ID || 'Silvi_Reader_Full_2.0';

async function testSDKModelInfo() {
  console.log('Testing SDK getDocumentModel method');
  console.log('Model:', modelId);
  console.log('Endpoint:', endpoint);
  console.log('');

  try {
    // Initialize admin client (same as in routes/models.js)
    const adminClient = new DocumentModelAdministrationClient(endpoint, new AzureKeyCredential(apiKey));
    
    console.log('1. Calling SDK getDocumentModel...');
    const model = await adminClient.getDocumentModel(modelId);
    
    console.log('\n2. Model basic info:');
    console.log('Model ID:', model.modelId);
    console.log('Created:', model.createdOn);
    console.log('Description:', model.description);
    console.log('');
    
    // Check if it's a composed model
    if (model.docTypes) {
      const docTypeNames = Object.keys(model.docTypes);
      console.log('3. Document types found:', docTypeNames.length);
      docTypeNames.forEach(name => console.log('   -', name));
      
      // Extract all unique fields
      const allFields = new Map();
      
      console.log('\n4. Analyzing fields in each document type:');
      docTypeNames.forEach(docTypeName => {
        const docType = model.docTypes[docTypeName];
        console.log(`\n   ${docTypeName}:`);
        
        if (docType.fieldSchema) {
          const fieldNames = Object.keys(docType.fieldSchema);
          console.log(`   Total fields: ${fieldNames.length}`);
          
          fieldNames.forEach(fieldName => {
            const fieldInfo = docType.fieldSchema[fieldName];
            console.log(`   - ${fieldName} (${fieldInfo.type})`);
            
            // Track unique fields
            if (!allFields.has(fieldName)) {
              allFields.set(fieldName, {
                type: fieldInfo.type,
                availableIn: []
              });
            }
            allFields.get(fieldName).availableIn.push(docTypeName);
          });
          
          // Check for Billing Address specifically
          if (docType.fieldSchema['Billing Address']) {
            console.log(`   ✅ Billing Address found in ${docTypeName}!`);
          }
        } else {
          console.log('   No fieldSchema found');
        }
      });
      
      console.log('\n5. Summary of all unique fields:');
      console.log(`Total unique fields: ${allFields.size}`);
      
      // Sort and display all fields
      const sortedFields = Array.from(allFields.entries()).sort((a, b) => a[0].localeCompare(b[0]));
      sortedFields.forEach(([fieldName, info]) => {
        console.log(`   - ${fieldName} (${info.type}) - Available in: ${info.availableIn.join(', ')}`);
      });
      
      // Check Billing Address
      console.log('\n6. Billing Address Check:');
      if (allFields.has('Billing Address')) {
        const billingInfo = allFields.get('Billing Address');
        console.log(`✅ Billing Address is available in: ${billingInfo.availableIn.join(', ')}`);
        console.log(`   Type: ${billingInfo.type}`);
      } else {
        console.log('❌ Billing Address not found in any document type');
      }
    } else {
      console.log('This is not a composed model or has no docTypes');
    }
    
    // Compare with REST API
    console.log('\n7. Comparing with REST API result...');
    const apiUrl = `${endpoint}/formrecognizer/documentModels/${modelId}?api-version=2023-07-31`;
    const response = await fetch(apiUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    });
    
    if (response.ok) {
      const restData = await response.json();
      const restFieldCount = new Set();
      
      Object.values(restData.docTypes || {}).forEach(docType => {
        Object.keys(docType.fieldSchema || {}).forEach(field => restFieldCount.add(field));
      });
      
      console.log(`REST API returns ${restFieldCount.size} unique fields`);
      console.log(`SDK returns ${allFields.size} unique fields`);
      
      if (restFieldCount.size === allFields.size) {
        console.log('✅ SDK and REST API return the same number of fields');
      } else {
        console.log('⚠️  Field count mismatch between SDK and REST API');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.details) {
      console.error('Details:', error.details);
    }
  }
}

// Run the test
testSDKModelInfo();