import { adminAPI } from '@/config/api';

// Model File Naming Configuration
export const updateModelFileNaming = async (modelId, data) => {
  const response = await adminAPI.put(`/models/${modelId}/naming-config`, data);
  return response.data;
};

// Model Excel Configuration
export const updateModelExcelConfig = async (modelId, data) => {
  const response = await adminAPI.put(`/models/${modelId}/excel-config`, data);
  return response.data;
};

// Add these methods to adminAPI object
adminAPI.updateModelFileNaming = updateModelFileNaming;
adminAPI.updateModelExcelConfig = updateModelExcelConfig;

export default adminAPI;