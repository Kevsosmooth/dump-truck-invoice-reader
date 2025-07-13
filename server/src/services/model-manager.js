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
   * Get all models accessible by a user
   */
  async getUserModels(userId) {
    const access = await prisma.modelAccess.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: new Date() } }
        ]
      },
      include: {
        modelConfig: {
          include: { 
            fieldConfigs: {
              where: { isEnabled: true },
              orderBy: { fieldOrder: 'asc' }
            }
          }
        }
      }
    });
    
    return access.map(a => ({
      id: a.modelConfig.id,
      displayName: a.customName || a.modelConfig.displayName,
      azureModelId: a.modelConfig.azureModelId,
      description: a.modelConfig.description,
      fields: a.modelConfig.fieldConfigs.map(f => ({
        fieldName: f.fieldName,
        displayName: f.displayName,
        fieldType: f.fieldType,
        isRequired: f.isRequired,
        defaultType: f.defaultType,
        defaultValue: f.defaultValue
      }))
    }));
  }

  /**
   * Get a specific model if user has access
   */
  async getUserModel(userId, modelConfigId) {
    const access = await prisma.modelAccess.findUnique({
      where: {
        modelConfigId_userId: {
          modelConfigId,
          userId
        }
      },
      include: {
        modelConfig: {
          include: { 
            fieldConfigs: {
              where: { isEnabled: true },
              orderBy: { fieldOrder: 'asc' }
            }
          }
        }
      }
    });

    if (!access || !access.isActive) {
      return null;
    }

    // Check expiration
    if (access.expiresAt && access.expiresAt < new Date()) {
      return null;
    }

    // Transform field configs into an object for client compatibility
    const fieldsObject = {};
    access.modelConfig.fieldConfigs.forEach(field => {
      fieldsObject[field.fieldName] = {
        displayName: field.displayName,
        fieldType: field.fieldType,
        isRequired: field.isRequired,
        defaultType: field.defaultType,
        defaultValue: field.defaultValue
      };
    });
    
    return {
      id: access.modelConfig.id,
      displayName: access.customName || access.modelConfig.displayName,
      azureModelId: access.modelConfig.azureModelId,
      description: access.modelConfig.description,
      fields: fieldsObject
    };
  }

  /**
   * Grant access to a model for multiple users
   */
  async grantAccess(modelConfigId, userIds, grantedBy, options = {}) {
    const { customName, expiresAt } = options;
    
    const results = await Promise.all(
      userIds.map(async (userId) => {
        try {
          return await prisma.modelAccess.upsert({
            where: {
              modelConfigId_userId: {
                modelConfigId,
                userId: parseInt(userId) // Ensure userId is an integer
              }
            },
            create: {
              modelConfigId,
              userId: parseInt(userId),
              customName: customName || null,
              grantedBy: grantedBy || null,
              expiresAt: expiresAt || null,
              isActive: true
            },
            update: {
              isActive: true,
              customName: customName || null,
              grantedBy: grantedBy || null,
              expiresAt: expiresAt || null,
              grantedAt: new Date()
            }
          });
        } catch (error) {
          console.error(`Error granting access to user ${userId}:`, error);
          throw error;
        }
      })
    );
    
    return results;
  }

  /**
   * Revoke access to a model for a user
   */
  async revokeAccess(modelConfigId, userId) {
    return await prisma.modelAccess.update({
      where: {
        modelConfigId_userId: {
          modelConfigId,
          userId
        }
      },
      data: {
        isActive: false
      }
    });
  }

  /**
   * Apply field defaults to extracted data
   */
  async applyFieldDefaults(modelConfigId, extractedData, context = {}) {
    const fields = await prisma.fieldConfiguration.findMany({
      where: { 
        modelConfigId,
        isEnabled: true 
      }
    });
    
    const processedData = { ...extractedData };
    
    for (const field of fields) {
      // Check if field is missing or empty
      const currentValue = processedData[field.fieldName];
      const isEmpty = !currentValue || 
                     (typeof currentValue === 'string' && currentValue.trim() === '') ||
                     (Array.isArray(currentValue) && currentValue.length === 0);
      
      if (isEmpty || (field.isRequired && isEmpty)) {
        processedData[field.fieldName] = await this.getDefaultValue(field, context);
      }
    }
    
    return processedData;
  }

  /**
   * Get default value based on field configuration
   */
  async getDefaultValue(field, context = {}) {
    switch (field.defaultType) {
      case 'STATIC':
        return field.defaultValue || '';
        
      case 'TODAY':
        return new Date().toISOString().split('T')[0];
        
      case 'CURRENT_USER':
        if (context.user) {
          return context.user.firstName && context.user.lastName
            ? `${context.user.firstName} ${context.user.lastName}`
            : context.user.email;
        }
        return 'Unknown User';
        
      case 'ORGANIZATION':
        if (context.user?.organization) {
          return context.user.organization.name;
        }
        return 'Unknown Organization';
        
      case 'EMPTY':
        return '';
        
      case 'CALCULATED':
        // Parse and evaluate formula (simple implementation)
        return this.evaluateFormula(field.defaultValue, context);
        
      default:
        return '';
    }
  }

  /**
   * Simple formula evaluator for calculated defaults
   */
  evaluateFormula(formula, context) {
    if (!formula) return '';
    
    // Simple token replacement
    let result = formula;
    
    // Replace tokens like {{TODAY}}, {{USER_NAME}}, etc.
    const tokens = {
      '{{TODAY}}': new Date().toISOString().split('T')[0],
      '{{CURRENT_YEAR}}': new Date().getFullYear().toString(),
      '{{CURRENT_MONTH}}': (new Date().getMonth() + 1).toString().padStart(2, '0'),
      '{{USER_NAME}}': context.user?.firstName || 'Unknown',
      '{{USER_EMAIL}}': context.user?.email || '',
      '{{TIMESTAMP}}': new Date().toISOString()
    };
    
    for (const [token, value] of Object.entries(tokens)) {
      result = result.replace(new RegExp(token, 'g'), value);
    }
    
    return result;
  }

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
   * Create a new model configuration
   */
  async createModelConfiguration(azureModelId, displayName, createdBy, options = {}) {
    const { description, fields = [] } = options;
    
    // Get Azure model details to extract fields
    const azureDetails = await this.getAzureModelDetails(azureModelId);
    const azureFields = this.extractFieldsFromAzureModel(azureDetails);
    
    // Merge provided fields with Azure fields
    const mergedFields = this.mergeFieldConfigurations(azureFields, fields);
    
    return await prisma.modelConfiguration.create({
      data: {
        azureModelId,
        displayName,
        description,
        createdBy,
        fieldConfigs: {
          create: mergedFields.map((field, index) => ({
            fieldName: field.fieldName,
            displayName: field.displayName || field.fieldName,
            fieldType: field.fieldType || 'TEXT',
            defaultType: field.defaultType || 'EMPTY',
            defaultValue: field.defaultValue,
            isRequired: field.isRequired || false,
            fieldOrder: index
          }))
        }
      },
      include: {
        fieldConfigs: true
      }
    });
  }

  /**
   * Extract fields from Azure model details
   */
  extractFieldsFromAzureModel(azureDetails) {
    const fields = [];
    
    if (azureDetails?.docTypes) {
      const docTypeKey = Object.keys(azureDetails.docTypes)[0];
      const fieldSchema = azureDetails.docTypes[docTypeKey]?.fieldSchema || {};
      
      for (const [fieldName, fieldInfo] of Object.entries(fieldSchema)) {
        fields.push({
          fieldName,
          displayName: this.formatFieldName(fieldName),
          fieldType: this.mapAzureFieldType(fieldInfo.type),
          isRequired: false // Azure doesn't provide this info
        });
      }
    }
    
    return fields;
  }

  /**
   * Format field name for display
   */
  formatFieldName(fieldName) {
    return fieldName
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  /**
   * Map Azure field type to our FieldType enum
   */
  mapAzureFieldType(azureType) {
    const typeMap = {
      'string': 'TEXT',
      'number': 'NUMBER',
      'date': 'DATE',
      'boolean': 'BOOLEAN',
      'currency': 'CURRENCY',
      'object': 'TEXT',
      'array': 'TEXT'
    };
    
    return typeMap[azureType] || 'TEXT';
  }

  /**
   * Merge field configurations
   */
  mergeFieldConfigurations(azureFields, providedFields) {
    const fieldMap = new Map();
    
    // Add Azure fields first
    azureFields.forEach(field => {
      fieldMap.set(field.fieldName, field);
    });
    
    // Override with provided fields
    providedFields.forEach(field => {
      if (fieldMap.has(field.fieldName)) {
        fieldMap.set(field.fieldName, {
          ...fieldMap.get(field.fieldName),
          ...field
        });
      } else {
        fieldMap.set(field.fieldName, field);
      }
    });
    
    return Array.from(fieldMap.values());
  }

  /**
   * Update field configurations for a model
   */
  async updateFieldConfigurations(modelConfigId, fields) {
    // Delete existing field configs
    await prisma.fieldConfiguration.deleteMany({
      where: { modelConfigId }
    });
    
    // Create new field configs
    const fieldConfigs = await Promise.all(
      fields.map((field, index) => 
        prisma.fieldConfiguration.create({
          data: {
            modelConfigId,
            fieldName: field.fieldName,
            displayName: field.displayName,
            fieldType: field.fieldType,
            defaultType: field.defaultType,
            defaultValue: field.defaultValue,
            isRequired: field.isRequired,
            isEnabled: field.isEnabled !== false,
            fieldOrder: index,
            validation: field.validation
          }
        })
      )
    );
    
    return fieldConfigs;
  }

  /**
   * Get all users with access to a model
   */
  async getModelUsers(modelConfigId) {
    const access = await prisma.modelAccess.findMany({
      where: { 
        modelConfigId,
        isActive: true 
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            organization: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        grantedByUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        grantedAt: 'desc'
      }
    });
    
    return access;
  }

  /**
   * Check if user has access to a model
   */
  async hasAccess(userId, modelConfigId) {
    const access = await prisma.modelAccess.findUnique({
      where: {
        modelConfigId_userId: {
          modelConfigId,
          userId
        }
      }
    });
    
    if (!access || !access.isActive) {
      return false;
    }
    
    // Check expiration
    if (access.expiresAt && access.expiresAt < new Date()) {
      return false;
    }
    
    return true;
  }

  /**
   * Sync Azure models with database
   */
  async syncModelsWithDatabase(adminUserId) {
    try {
      const azureModels = await this.listAzureModels();
      const syncResults = {
        created: 0,
        updated: 0,
        errors: []
      };

      for (const azureModel of azureModels) {
        try {
          // Check if model already exists
          const existingModel = await prisma.modelConfiguration.findUnique({
            where: { azureModelId: azureModel.modelId }
          });

          if (!existingModel) {
            // Create new model
            await this.createModelConfiguration(
              azureModel.modelId,
              azureModel.description || azureModel.modelId,
              adminUserId,
              {
                description: azureModel.description
              }
            );
            syncResults.created++;
          } else {
            // Update existing model (just the description)
            await prisma.modelConfiguration.update({
              where: { id: existingModel.id },
              data: {
                description: azureModel.description || existingModel.description,
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
   * Get all configured models (admin view)
   */
  async getAllModels() {
    const models = await prisma.modelConfiguration.findMany({
      include: {
        _count: {
          select: { 
            modelAccess: {
              where: { isActive: true }
            },
            fieldConfigs: true 
          }
        },
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    return models;
  }

  /**
   * Get model details for admin
   */
  async getModelDetails(modelConfigId) {
    const model = await prisma.modelConfiguration.findUnique({
      where: { id: modelConfigId },
      include: {
        fieldConfigs: {
          orderBy: { fieldOrder: 'asc' }
        },
        modelAccess: {
          where: { isActive: true },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        creator: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        }
      }
    });
    
    return model;
  }
}

// Export singleton instance
export default new ModelManager();