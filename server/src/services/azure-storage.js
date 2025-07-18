import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters, BlobSASPermissions } from '@azure/storage-blob';
import * as dotenv from 'dotenv';

dotenv.config();

// Azure Storage configuration
const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = process.env.AZURE_STORAGE_CONTAINER_NAME || 'documents';

// Determine environment prefix
const environment = process.env.NODE_ENV || 'development';
const environmentPrefix = environment === 'production' ? 'production/' : 'development/';

// Extract account name and key from connection string if needed
let accountName = process.env.AZURE_STORAGE_ACCOUNT_NAME;
let accountKey = process.env.AZURE_STORAGE_ACCOUNT_KEY;
let blobServiceClient = null;
let sharedKeyCredential = null;

if (connectionString) {
  // Use connection string
  blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  
  // Extract account name and key from connection string for SAS generation
  const matches = connectionString.match(/AccountName=([^;]+).*AccountKey=([^;]+)/);
  if (matches) {
    accountName = matches[1];
    accountKey = matches[2];
    sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  }
} else if (accountName && accountKey) {
  // Use account name and key
  sharedKeyCredential = new StorageSharedKeyCredential(accountName, accountKey);
  blobServiceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    sharedKeyCredential
  );
} else {
  console.warn('Azure Storage credentials not configured');
}

// Get container client
const containerClient = blobServiceClient?.getContainerClient(containerName);

// Ensure container exists
async function ensureContainerExists() {
  if (!containerClient) return;
  
  try {
    await containerClient.createIfNotExists();
    // No public access - will use SAS tokens for secure access
  } catch (error) {
    console.error('Error creating container:', error);
  }
}

// Initialize container on startup
ensureContainerExists();

/**
 * Upload a buffer to Azure Blob Storage
 * @param {Buffer} buffer - File buffer to upload
 * @param {string} blobPath - Path in blob storage (e.g., users/123/sessions/abc/file.pdf)
 * @param {Object} metadata - Optional metadata for the blob
 * @returns {Promise<{blobUrl: string, blobName: string}>}
 */
export async function uploadToBlob(buffer, blobPath, metadata = {}) {
  if (!containerClient) {
    throw new Error('Azure Storage not configured');
  }

  try {
    // Prepend environment prefix to all paths
    const fullBlobPath = environmentPrefix + blobPath;
    const blockBlobClient = containerClient.getBlockBlobClient(fullBlobPath);
    
    // Upload with metadata
    const uploadOptions = {
      blobHTTPHeaders: {
        blobContentType: metadata.contentType || 'application/pdf'
      },
      metadata: metadata
    };

    await blockBlobClient.upload(buffer, buffer.length, uploadOptions);
    
    return {
      blobUrl: blockBlobClient.url,
      blobName: fullBlobPath
    };
  } catch (error) {
    console.error('Error uploading to blob:', error);
    throw error;
  }
}

/**
 * Generate a SAS URL for secure blob access
 * @param {string} blobName - Name/path of the blob
 * @param {number} expiryHours - Hours until expiry (default 24)
 * @param {string} permissions - SAS permissions (default 'r' for read)
 * @returns {Promise<{sasUrl: string, expiresAt: Date}>}
 */
export async function generateSasUrl(blobName, expiryHours = 24, permissions = 'r') {
  if (!containerClient || !sharedKeyCredential) {
    throw new Error('Azure Storage not configured');
  }

  try {
    // If blobName doesn't already have environment prefix, add it
    const fullBlobName = blobName.startsWith(environmentPrefix) ? blobName : environmentPrefix + blobName;
    const blockBlobClient = containerClient.getBlockBlobClient(fullBlobName);
    
    // Calculate expiry time
    const startsOn = new Date();
    const expiresOn = new Date(startsOn);
    expiresOn.setHours(expiresOn.getHours() + expiryHours);

    // Generate SAS token with additional parameters for Azure services
    const sasOptions = {
      containerName,
      blobName: fullBlobName,
      permissions: BlobSASPermissions.parse(permissions),
      startsOn,
      expiresOn,
      protocol: 'https', // Ensure HTTPS only
      version: '2020-12-06', // Use a specific version
    };

    const sasToken = generateBlobSASQueryParameters(sasOptions, sharedKeyCredential).toString();

    return {
      sasUrl: `${blockBlobClient.url}?${sasToken}`,
      expiresAt: expiresOn
    };
  } catch (error) {
    console.error('Error generating SAS URL:', error);
    throw error;
  }
}

/**
 * Delete a blob from storage
 * @param {string} blobName - Name/path of the blob to delete
 * @returns {Promise<void>}
 */
export async function deleteBlob(blobName) {
  if (!containerClient) {
    throw new Error('Azure Storage not configured');
  }

  try {
    // If blobName doesn't already have environment prefix, add it
    const fullBlobName = blobName.startsWith(environmentPrefix) ? blobName : environmentPrefix + blobName;
    const blockBlobClient = containerClient.getBlockBlobClient(fullBlobName);
    await blockBlobClient.deleteIfExists();
  } catch (error) {
    console.error('Error deleting blob:', error);
    throw error;
  }
}

/**
 * Delete all blobs with a specific prefix (for cleanup)
 * @param {string} prefix - Blob prefix (e.g., users/123/sessions/abc/)
 * @returns {Promise<number>} Number of blobs deleted
 */
export async function deleteBlobsByPrefix(prefix) {
  if (!containerClient) {
    throw new Error('Azure Storage not configured');
  }

  let deletedCount = 0;
  
  try {
    // Add environment prefix
    const fullPrefix = environmentPrefix + prefix;
    
    console.log(`[AZURE-STORAGE] Deleting blobs with prefix: ${fullPrefix}`);
    console.log(`[AZURE-STORAGE] Environment: ${environment}, Container: ${containerName}`);
    
    // List all blobs with the prefix
    const blobsToDelete = [];
    for await (const blob of containerClient.listBlobsFlat({ prefix: fullPrefix })) {
      blobsToDelete.push(blob.name);
    }
    
    console.log(`[AZURE-STORAGE] Found ${blobsToDelete.length} blobs to delete with prefix: ${fullPrefix}`);
    
    // Delete each blob
    for (const blobName of blobsToDelete) {
      console.log(`[AZURE-STORAGE] Deleting blob: ${blobName}`);
      // Use the blob client directly since blobName already has the full path
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);
      await blockBlobClient.deleteIfExists();
      deletedCount++;
    }
    
    console.log(`[AZURE-STORAGE] Successfully deleted ${deletedCount} blobs`);
    
    return deletedCount;
  } catch (error) {
    console.error('Error deleting blobs by prefix:', error);
    throw error;
  }
}

/**
 * Check if a blob exists
 * @param {string} blobName - Name/path of the blob
 * @returns {Promise<boolean>}
 */
export async function blobExists(blobName) {
  if (!containerClient) {
    throw new Error('Azure Storage not configured');
  }

  try {
    // If blobName doesn't already have environment prefix, add it
    const fullBlobName = blobName.startsWith(environmentPrefix) ? blobName : environmentPrefix + blobName;
    const blockBlobClient = containerClient.getBlockBlobClient(fullBlobName);
    return await blockBlobClient.exists();
  } catch (error) {
    console.error('Error checking blob existence:', error);
    return false;
  }
}

/**
 * Download a blob to buffer
 * @param {string} blobName - Name/path of the blob
 * @returns {Promise<Buffer>}
 */
export async function downloadBlob(blobName) {
  if (!containerClient) {
    throw new Error('Azure Storage not configured');
  }

  try {
    // If blobName doesn't already have environment prefix, add it
    const fullBlobName = blobName.startsWith(environmentPrefix) ? blobName : environmentPrefix + blobName;
    const blockBlobClient = containerClient.getBlockBlobClient(fullBlobName);
    const downloadResponse = await blockBlobClient.download();
    
    const chunks = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(chunk);
    }
    
    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Error downloading blob:', error);
    throw error;
  }
}

/**
 * List all blobs with a specific prefix
 * @param {string} prefix - Blob prefix
 * @returns {Promise<Array>} Array of blob info
 */
export async function listBlobsByPrefix(prefix) {
  if (!containerClient) {
    throw new Error('Azure Storage not configured');
  }

  const blobs = [];
  
  try {
    // Add environment prefix
    const fullPrefix = environmentPrefix + prefix;
    for await (const blob of containerClient.listBlobsFlat({ prefix: fullPrefix })) {
      blobs.push({
        name: blob.name,
        size: blob.properties.contentLength,
        lastModified: blob.properties.lastModified,
        contentType: blob.properties.contentType
      });
    }
    
    return blobs;
  } catch (error) {
    console.error('Error listing blobs:', error);
    throw error;
  }
}

/**
 * Extract blob path from a full URL, removing container and environment prefix
 * @param {string} blobUrl - Full blob URL
 * @returns {string} The blob path without container and environment prefix
 */
export function extractBlobPath(blobUrl) {
  try {
    const url = new URL(blobUrl);
    const pathParts = url.pathname.split('/');
    // Remove the container name (first part after /)
    const pathWithoutContainer = pathParts.slice(2).join('/');
    
    // Decode URL encoding
    const decodedPath = decodeURIComponent(pathWithoutContainer);
    
    // Remove environment prefix if present
    if (decodedPath.startsWith(environmentPrefix)) {
      return decodedPath.slice(environmentPrefix.length);
    }
    
    return decodedPath;
  } catch (error) {
    console.error('Error extracting blob path:', error);
    return blobUrl;
  }
}

/**
 * Get current environment prefix
 * @returns {string} The environment prefix (e.g., 'production/' or 'development/')
 */
export function getEnvironmentPrefix() {
  return environmentPrefix;
}