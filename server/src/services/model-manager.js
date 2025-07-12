import prisma from '../config/prisma.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const {
  AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: endpoint,
  AZURE_DOCUMENT_INTELLIGENCE_KEY: apiKey
} = process.env;

// Cache for model details to reduce API calls
const modelCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class ModelManager {
  /**
   * List all available models from Azure
   */
  async listAzureModels() {
    try {
      const apiUrl = `${endpoint}/formrecognizer/documentModels?api-version=2023-07-31`;
      const response = await axios.get(apiUrl, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        }
      });

      return response.data.value || [];
    } catch (error) {
      console.error('Error listing Azure models:', error);
      throw new Error('Failed to list Azure models');
    }
  }

  /**
   * Get detailed information about a specific model from Azure
   */
  async getAzureModelDetails(modelId) {
    // Check cache first
    const cached = modelCache.get(modelId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    try {
      const apiUrl = `${endpoint}/formrecognizer/documentModels/${modelId}?api-version=2023-07-31`;
      const response = await axios.get(apiUrl, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        }
      });

      // Cache the result
      modelCache.set(modelId, {
        data: response.data,
        timestamp: Date.now()
      });

      return response.data;
    } catch (error) {
      console.error(`Error getting model details for ${modelId}:`, error);
      throw new Error(`Failed to get model details for ${modelId}`);
    }
  }

  /**
   * Sync Azure models with database
   */
  async syncModelsWithDatabase() {
    try {
      const azureModels = await this.listAzureModels();
      const syncResults = {
        created: 0,
        updated: 0,
        errors: []
      };

      for (const azureModel of azureModels) {
        try {
          // Get existing model from database
          const existingModel = await prisma.customModel.findUnique({
            where: { modelId: azureModel.modelId }
          });

          if (!existingModel) {
            // Create new model
            const modelDetails = await this.getAzureModelDetails(azureModel.modelId);
            
            await prisma.customModel.create({
              data: {
                modelId: azureModel.modelId,
                displayName: azureModel.description || azureModel.modelId,
                description: azureModel.description,
                isActive: true,
                isPublic: false,
                azureDetails: modelDetails,
                createdAt: new Date(azureModel.createdDateTime),
                updatedAt: new Date()
              }
            });
            syncResults.created++;
          } else {
            // Update existing model
            const modelDetails = await this.getAzureModelDetails(azureModel.modelId);
            
            await prisma.customModel.update({
              where: { id: existingModel.id },
              data: {
                displayName: azureModel.description || existingModel.displayName,
                description: azureModel.description || existingModel.description,
                azureDetails: modelDetails,
                updatedAt: new Date()
              }
            });
            syncResults.updated++;
          }
        } catch (error) {
          syncResults.errors.push({
            modelId: azureModel.modelId,
            error: error.message
          });
        }
      }

      return syncResults;
    } catch (error) {
      console.error('Error syncing models:', error);
      throw new Error('Failed to sync models with database');
    }
  }

  /**
   * Get user's available models based on permissions
   */
  async getUserAvailableModels(userId, organizationId = null) {
    try {
      const whereClause = {
        isActive: true,
        OR: [
          { isPublic: true },
          { ownerId: userId }
        ]
      };

      // If user belongs to an organization, include organization models
      if (organizationId) {
        whereClause.OR.push({ organizationId });
      }

      const models = await prisma.customModel.findMany({
        where: whereClause,
        include: {
          fieldConfigurations: {
            where: { isEnabled: true },
            orderBy: { displayOrder: 'asc' }
          }
        },
        orderBy: [
          { isPublic: 'desc' },
          { displayName: 'asc' }
        ]
      });

      return models;
    } catch (error) {
      console.error('Error getting user available models:', error);
      throw new Error('Failed to get user available models');
    }
  }

  /**
   * Get model with field configurations
   */
  async getModelWithFieldConfigs(modelId, userId = null) {
    try {
      const model = await prisma.customModel.findUnique({
        where: { modelId },
        include: {
          fieldConfigurations: {
            where: { isEnabled: true },
            orderBy: { displayOrder: 'asc' }
          },
          owner: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          organization: {
            select: {
              id: true,
              name: true
            }
          }
        }
      });

      if (!model) {
        throw new Error('Model not found');
      }

      // Check access permissions if userId is provided
      if (userId && !this.hasModelAccess(model, userId)) {
        throw new Error('Access denied to this model');
      }

      // Get Azure model details if not cached
      const azureDetails = await this.getAzureModelDetails(modelId);
      
      // Merge Azure field info with database configurations
      const enrichedFields = this.enrichFieldConfigurations(
        model.fieldConfigurations,
        azureDetails
      );

      return {
        ...model,
        fieldConfigurations: enrichedFields,
        azureDetails
      };
    } catch (error) {
      console.error('Error getting model with field configs:', error);
      throw error;
    }
  }

  /**
   * Check if user has access to a model
   */
  hasModelAccess(model, userId, organizationId = null) {
    // Public models are accessible to everyone
    if (model.isPublic) return true;

    // Owner has access
    if (model.ownerId === userId) return true;

    // Organization members have access to organization models
    if (organizationId && model.organizationId === organizationId) return true;

    return false;
  }

  /**
   * Enrich field configurations with Azure model details
   */
  enrichFieldConfigurations(fieldConfigs, azureDetails) {
    const azureFields = azureDetails?.docTypes?.[azureDetails.modelId]?.fieldSchema || {};
    
    return fieldConfigs.map(config => {
      const azureField = azureFields[config.fieldName];
      
      return {
        ...config,
        azureType: azureField?.type || 'string',
        azureDescription: azureField?.description,
        isRequired: azureField?.required || false
      };
    });
  }

  /**
   * Apply default values to extracted data
   */
  applyDefaultValues(extractedData, fieldConfigurations) {
    const processedData = { ...extractedData };

    for (const config of fieldConfigurations) {
      // Skip if field already has a value
      if (processedData[config.fieldName]) continue;

      // Apply default value based on type
      if (config.defaultValue) {
        switch (config.defaultValueType) {
          case 'STATIC':
            processedData[config.fieldName] = config.defaultValue;
            break;
            
          case 'CURRENT_DATE':
            processedData[config.fieldName] = new Date().toISOString().split('T')[0];
            break;
            
          case 'CURRENT_DATETIME':
            processedData[config.fieldName] = new Date().toISOString();
            break;
            
          case 'FUNCTION':
            // Execute custom function (if safe and allowed)
            processedData[config.fieldName] = this.executeDefaultFunction(
              config.defaultValue,
              extractedData
            );
            break;
            
          default:
            processedData[config.fieldName] = config.defaultValue;
        }
      }
    }

    return processedData;
  }

  /**
   * Execute a default value function safely
   */
  executeDefaultFunction(functionStr, context) {
    // This is a simplified version - in production, you'd want
    // more robust sandboxing and security measures
    try {
      const allowedFunctions = {
        'TODAY': () => new Date().toISOString().split('T')[0],
        'NOW': () => new Date().toISOString(),
        'CONCAT': (...args) => args.join(''),
        'UPPER': (str) => String(str).toUpperCase(),
        'LOWER': (str) => String(str).toLowerCase()
      };

      // Parse simple function calls like "TODAY()" or "UPPER(fieldName)"
      const match = functionStr.match(/^(\w+)\((.*)\)$/);
      if (!match) return functionStr;

      const [, funcName, args] = match;
      const func = allowedFunctions[funcName];
      
      if (!func) return functionStr;

      // Parse arguments (simple implementation)
      const parsedArgs = args
        .split(',')
        .map(arg => {
          const trimmed = arg.trim();
          // If it's a field reference, get value from context
          if (context[trimmed]) return context[trimmed];
          // Otherwise return as string
          return trimmed.replace(/^["']|["']$/g, '');
        });

      return func(...parsedArgs);
    } catch (error) {
      console.error('Error executing default function:', error);
      return functionStr;
    }
  }

  /**
   * Filter and order fields based on configuration
   */
  filterAndOrderFields(extractedData, fieldConfigurations) {
    const orderedData = {};
    
    // Process fields in display order
    const enabledFields = fieldConfigurations
      .filter(config => config.isEnabled)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    for (const config of enabledFields) {
      const fieldName = config.fieldName;
      const displayName = config.customDisplayName || fieldName;
      
      if (extractedData[fieldName] !== undefined) {
        orderedData[displayName] = extractedData[fieldName];
      }
    }

    return orderedData;
  }

  /**
   * Process extracted data with all configurations
   */
  async processExtractedData(modelId, extractedData, userId = null) {
    try {
      // Get model with configurations
      const model = await this.getModelWithFieldConfigs(modelId, userId);
      
      // Apply default values
      const dataWithDefaults = this.applyDefaultValues(
        extractedData,
        model.fieldConfigurations
      );
      
      // Filter and order fields
      const processedData = this.filterAndOrderFields(
        dataWithDefaults,
        model.fieldConfigurations
      );

      return {
        modelId: model.modelId,
        modelName: model.displayName,
        processedData,
        fieldConfigurations: model.fieldConfigurations,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error processing extracted data:', error);
      throw error;
    }
  }

  /**
   * Create or update field configuration
   */
  async upsertFieldConfiguration(modelId, fieldConfig) {
    try {
      const model = await prisma.customModel.findUnique({
        where: { modelId }
      });

      if (!model) {
        throw new Error('Model not found');
      }

      const data = {
        customModelId: model.id,
        fieldName: fieldConfig.fieldName,
        customDisplayName: fieldConfig.customDisplayName,
        isEnabled: fieldConfig.isEnabled ?? true,
        isRequired: fieldConfig.isRequired ?? false,
        defaultValue: fieldConfig.defaultValue,
        defaultValueType: fieldConfig.defaultValueType || 'STATIC',
        displayOrder: fieldConfig.displayOrder ?? 999,
        validationRules: fieldConfig.validationRules || {}
      };

      return await prisma.fieldConfiguration.upsert({
        where: {
          customModelId_fieldName: {
            customModelId: model.id,
            fieldName: fieldConfig.fieldName
          }
        },
        update: data,
        create: data
      });
    } catch (error) {
      console.error('Error upserting field configuration:', error);
      throw error;
    }
  }

  /**
   * Get model usage statistics
   */
  async getModelUsageStats(modelId, startDate = null, endDate = null) {
    try {
      const model = await prisma.customModel.findUnique({
        where: { modelId }
      });

      if (!model) {
        throw new Error('Model not found');
      }

      const whereClause = {
        customModelId: model.id
      };

      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = new Date(startDate);
        if (endDate) whereClause.createdAt.lte = new Date(endDate);
      }

      const [totalJobs, successfulJobs, failedJobs] = await Promise.all([
        prisma.job.count({ where: whereClause }),
        prisma.job.count({ where: { ...whereClause, status: 'completed' } }),
        prisma.job.count({ where: { ...whereClause, status: 'failed' } })
      ]);

      const avgProcessingTime = await prisma.job.aggregate({
        where: { ...whereClause, status: 'completed' },
        _avg: {
          processingTime: true
        }
      });

      return {
        modelId,
        totalJobs,
        successfulJobs,
        failedJobs,
        successRate: totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0,
        avgProcessingTime: avgProcessingTime._avg.processingTime || 0
      };
    } catch (error) {
      console.error('Error getting model usage stats:', error);
      throw error;
    }
  }
}

// Export singleton instance
export default new ModelManager();