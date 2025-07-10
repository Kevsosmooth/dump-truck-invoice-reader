import * as dotenv from 'dotenv';

dotenv.config();

const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
const modelId = process.env.AZURE_CUSTOM_MODEL_ID || 'Silvi_Reader_Full_2.0';

async function testFieldExtraction() {
  console.log('Testing field extraction for model:', modelId);
  console.log('Endpoint:', endpoint);
  console.log('');

  try {
    // 1. Get raw model info from Azure
    console.log('1. Fetching RAW model info from Azure API...');
    const apiUrl = `${endpoint}/formrecognizer/documentModels/${modelId}?api-version=2023-07-31`;
    
    const response = await fetch(apiUrl, {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey
      }
    });
    
    if (!response.ok) {
      throw new Error(`Azure API error: ${response.status} ${response.statusText}`);
    }
    
    const modelData = await response.json();
    
    // 2. Analyze the model structure
    console.log('\n2. Model Structure Analysis:');
    console.log('Model ID:', modelData.modelId);
    console.log('Description:', modelData.description);
    console.log('Document Types:', Object.keys(modelData.docTypes));
    
    // 3. Extract all unique fields across all document types
    const allFields = new Set();
    const fieldDetails = {};
    
    Object.entries(modelData.docTypes).forEach(([docTypeName, docType]) => {
      console.log(`\n3. Fields in ${docTypeName}:`);
      if (docType.fieldSchema) {
        Object.entries(docType.fieldSchema).forEach(([fieldName, fieldInfo]) => {
          allFields.add(fieldName);
          if (!fieldDetails[fieldName]) {
            fieldDetails[fieldName] = {
              type: fieldInfo.type,
              availableIn: []
            };
          }
          fieldDetails[fieldName].availableIn.push(docTypeName);
          console.log(`   - ${fieldName} (${fieldInfo.type})`);
        });
      }
    });
    
    // 4. Check for Billing Address specifically
    console.log('\n4. Billing Address Field Analysis:');
    if (fieldDetails['Billing Address']) {
      console.log('✅ Billing Address field found!');
      console.log('Type:', fieldDetails['Billing Address'].type);
      console.log('Available in document types:', fieldDetails['Billing Address'].availableIn);
    } else {
      console.log('❌ Billing Address field NOT found in model definition');
    }
    
    // 5. Summary
    console.log('\n5. Summary:');
    console.log('Total unique fields across all document types:', allFields.size);
    console.log('\nAll fields (sorted):');
    Array.from(allFields).sort().forEach(field => {
      console.log(`   - ${field} (${fieldDetails[field].type}) - Available in: ${fieldDetails[field].availableIn.join(', ')}`);
    });
    
    // 6. Test the updated API endpoint
    console.log('\n6. Testing local API endpoint...');
    const localResponse = await fetch(`http://localhost:3003/api/models/${modelId}/info`);
    if (localResponse.ok) {
      const localData = await localResponse.json();
      console.log('Local API returned', Object.keys(localData.fields).length, 'fields');
      if (localData.fields['Billing Address']) {
        console.log('✅ Billing Address is now included in API response');
      } else {
        console.log('❌ Billing Address is still missing from API response');
      }
    } else {
      console.log('❌ Could not test local API (server may not be running)');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the test
testFieldExtraction();