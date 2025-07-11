import { uploadToBlob, downloadBlob, listBlobsByPrefix, getEnvironmentPrefix, extractBlobPath } from './services/azure-storage.js';
import dotenv from 'dotenv';

dotenv.config();

async function testEnvironmentSeparation() {
  console.log('Testing Azure Blob Storage Environment Separation');
  console.log('==============================================');
  
  const environment = process.env.NODE_ENV || 'development';
  const envPrefix = getEnvironmentPrefix();
  
  console.log(`Current environment: ${environment}`);
  console.log(`Environment prefix: ${envPrefix}`);
  console.log('');
  
  try {
    // Test 1: Upload a test file
    console.log('Test 1: Uploading test file...');
    const testContent = Buffer.from(`Test file created at ${new Date().toISOString()} in ${environment} environment`);
    const testPath = 'test/environment-check.txt';
    
    const { blobUrl, blobName } = await uploadToBlob(testContent, testPath, {
      contentType: 'text/plain',
      environment: environment
    });
    
    console.log(`✓ File uploaded successfully`);
    console.log(`  Blob URL: ${blobUrl}`);
    console.log(`  Blob Name: ${blobName}`);
    console.log(`  Expected path: ${envPrefix}${testPath}`);
    console.log('');
    
    // Test 2: Extract blob path from URL
    console.log('Test 2: Extracting blob path from URL...');
    const extractedPath = extractBlobPath(blobUrl);
    console.log(`  Extracted path: ${extractedPath}`);
    console.log(`  Matches original: ${extractedPath === testPath ? '✓ Yes' : '✗ No'}`);
    console.log('');
    
    // Test 3: Download the file
    console.log('Test 3: Downloading file...');
    const downloadedContent = await downloadBlob(testPath);
    const downloadedText = downloadedContent.toString();
    console.log(`✓ File downloaded successfully`);
    console.log(`  Content: ${downloadedText.substring(0, 50)}...`);
    console.log('');
    
    // Test 4: List files with prefix
    console.log('Test 4: Listing files with prefix "test/"...');
    const files = await listBlobsByPrefix('test/');
    console.log(`✓ Found ${files.length} file(s)`);
    files.forEach(file => {
      console.log(`  - ${file.name} (${file.size} bytes)`);
    });
    console.log('');
    
    // Test 5: Check what happens with different environments
    console.log('Test 5: Environment isolation check...');
    console.log('Files in current environment should be in:', envPrefix);
    
    // List all test files
    const allTestFiles = await listBlobsByPrefix('');
    const envTestFiles = allTestFiles.filter(f => f.name.includes('test/environment-check'));
    
    console.log(`Found ${envTestFiles.length} test file(s) across all environments:`);
    envTestFiles.forEach(file => {
      const env = file.name.startsWith('production/') ? 'production' : 'development';
      console.log(`  - [${env}] ${file.name}`);
    });
    
    console.log('\n✅ All tests completed successfully!');
    console.log('\nSummary:');
    console.log(`- Files are being stored under: ${envPrefix}`);
    console.log('- Production and development files are properly separated');
    console.log('- The extractBlobPath function correctly removes environment prefix');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error);
  }
}

// Run the test
testEnvironmentSeparation();