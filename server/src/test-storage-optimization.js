import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = 'http://localhost:3003/api';

async function testStorageOptimization() {
  console.log('Testing Storage Optimization');
  console.log('============================\n');
  
  // Replace with your actual session ID and token
  const sessionId = process.argv[2];
  const token = process.argv[3];
  
  if (!sessionId || !token) {
    console.error('Usage: node test-storage-optimization.js <sessionId> <token>');
    console.error('Get these values from the browser console after uploading files');
    process.exit(1);
  }
  
  try {
    // 1. Get storage stats before cleanup
    console.log('1. Fetching storage statistics before cleanup...');
    const statsBeforeRes = await fetch(`${API_URL}/dev/storage-stats/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!statsBeforeRes.ok) {
      throw new Error(`Failed to get stats: ${await statsBeforeRes.text()}`);
    }
    
    const statsBefore = await statsBeforeRes.json();
    console.log('\nStorage before cleanup:');
    console.log(`- Total files: ${statsBefore.storageStats.total}`);
    console.log(`- Total size: ${statsBefore.storageStats.totalSizeFormatted}`);
    console.log(`- Originals: ${statsBefore.storageStats.byCategory.originals.count} files (${statsBefore.storageStats.byCategory.originals.sizeFormatted})`);
    console.log(`- Pages: ${statsBefore.storageStats.byCategory.pages.count} files (${statsBefore.storageStats.byCategory.pages.sizeFormatted})`);
    console.log(`- Processed: ${statsBefore.storageStats.byCategory.processed.count} files (${statsBefore.storageStats.byCategory.processed.sizeFormatted})`);
    console.log(`- Potential savings: ${statsBefore.storageStats.potentialSavings}`);
    
    // 2. Run intermediate cleanup
    console.log('\n2. Running intermediate cleanup (keeping processed files)...');
    const cleanupRes = await fetch(`${API_URL}/dev/cleanup-storage/${sessionId}`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ aggressive: false })
    });
    
    if (!cleanupRes.ok) {
      throw new Error(`Cleanup failed: ${await cleanupRes.text()}`);
    }
    
    const cleanupResult = await cleanupRes.json();
    console.log('\nCleanup results:');
    console.log(`- Files deleted: ${cleanupResult.filesDeleted}`);
    console.log(`- Files kept: ${cleanupResult.filesKept}`);
    console.log(`- Estimated space saved: ${cleanupResult.estimatedSpaceSaved}`);
    
    // 3. Get storage stats after cleanup
    console.log('\n3. Fetching storage statistics after cleanup...');
    const statsAfterRes = await fetch(`${API_URL}/dev/storage-stats/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const statsAfter = await statsAfterRes.json();
    console.log('\nStorage after cleanup:');
    console.log(`- Total files: ${statsAfter.storageStats.total}`);
    console.log(`- Total size: ${statsAfter.storageStats.totalSizeFormatted}`);
    console.log(`- Processed: ${statsAfter.storageStats.byCategory.processed.count} files (${statsAfter.storageStats.byCategory.processed.sizeFormatted})`);
    
    console.log('\n✅ Storage optimization test completed!');
    console.log(`Space saved: ${statsBefore.storageStats.totalSizeFormatted} → ${statsAfter.storageStats.totalSizeFormatted}`);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  }
}

testStorageOptimization();