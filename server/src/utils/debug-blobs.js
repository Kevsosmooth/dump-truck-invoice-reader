import { listBlobsByPrefix } from '../services/azure-storage.js';

// Debug function to list all blobs for a session
export async function debugSessionBlobs(sessionId, blobPrefix) {
  try {
    console.log(`\n=== Debugging blobs for session ${sessionId} ===`);
    console.log(`Blob prefix: ${blobPrefix}`);
    
    const blobs = await listBlobsByPrefix(blobPrefix);
    
    console.log(`Found ${blobs.length} blobs:`);
    
    // Group blobs by folder
    const folders = {};
    
    blobs.forEach(blob => {
      const parts = blob.name.split('/');
      const folder = parts.slice(0, -1).join('/');
      const fileName = parts[parts.length - 1];
      
      if (!folders[folder]) {
        folders[folder] = [];
      }
      folders[folder].push({
        name: fileName,
        size: blob.properties.contentLength,
        lastModified: blob.properties.lastModified,
        contentType: blob.properties.contentType,
      });
    });
    
    // Print folder structure
    Object.entries(folders).forEach(([folder, files]) => {
      console.log(`\n📁 ${folder}/`);
      files.forEach(file => {
        console.log(`   📄 ${file.name} (${formatBytes(file.size)}, ${file.contentType})`);
      });
    });
    
    return folders;
  } catch (error) {
    console.error('Error debugging blobs:', error);
    return null;
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}