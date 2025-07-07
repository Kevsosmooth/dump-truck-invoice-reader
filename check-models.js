const { DocumentAnalysisClient, DocumentModelAdministrationClient, AzureKeyCredential } = require('@azure/ai-form-recognizer');

async function checkModels() {
  const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT || "https://silvi.cognitiveservices.azure.com/";
  const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
  
  if (!apiKey) {
    console.error('Please set AZURE_DOCUMENT_INTELLIGENCE_KEY environment variable');
    return;
  }
  
  const adminClient = new DocumentModelAdministrationClient(
    endpoint,
    new AzureKeyCredential(apiKey)
  );
  
  console.log('Checking all custom models in Azure Document Intelligence...\n');
  
  const targetModelId = 'user_demo-user_test_model_1751897049879';
  const targetOperationId = '31533674473_9ac40a61-c8f5-447b-bc07-6e02ad50dcce';
  
  console.log(`Looking for model: ${targetModelId}`);
  console.log(`Operation ID: ${targetOperationId}\n`);
  
  try {
    // List all models
    const models = [];
    for await (const model of adminClient.listDocumentModels()) {
      models.push(model);
    }
    
    console.log(`Total models found: ${models.length}\n`);
    
    // Check if our model exists
    const ourModel = models.find(m => m.modelId === targetModelId);
    
    if (ourModel) {
      console.log('✅ FOUND YOUR MODEL!');
      console.log('Model details:');
      console.log(`- Model ID: ${ourModel.modelId}`);
      console.log(`- Created: ${ourModel.createdOn}`);
      console.log(`- Description: ${ourModel.description || 'N/A'}`);
      
      // Get full model details
      try {
        const fullModel = await adminClient.getDocumentModel(targetModelId);
        console.log(`\nFull model details:`);
        console.log(`- Status: Active`);
        console.log(`- Document types: ${Object.keys(fullModel.docTypes || {}).join(', ')}`);
        console.log(`- API version: ${fullModel.apiVersion}`);
        console.log(`- Created: ${fullModel.createdOn}`);
        console.log('\n✅ Your model training completed successfully!');
      } catch (error) {
        console.error('Error getting full model details:', error.message);
      }
    } else {
      console.log('❌ Model not found in the list');
      console.log('\nAll available models:');
      models.forEach((model, index) => {
        console.log(`${index + 1}. ${model.modelId} (Created: ${model.createdOn})`);
      });
    }
    
    // Try to check operation status directly
    console.log('\n\nChecking operation status...');
    try {
      const response = await fetch(
        `${endpoint}/formrecognizer/operations/${targetOperationId}?api-version=2023-07-31`,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': apiKey
          }
        }
      );
      
      if (response.ok) {
        const operation = await response.json();
        console.log('Operation status:', JSON.stringify(operation, null, 2));
      } else {
        console.log('Failed to check operation status:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('Error checking operation:', error.message);
    }
    
  } catch (error) {
    console.error('Error listing models:', error);
  }
}

// Load environment variables
require('dotenv').config();
checkModels();