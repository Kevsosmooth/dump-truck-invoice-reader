/**
 * Utility functions for masking sensitive data in demo mode
 */

// Fields to mask in demo mode
const SENSITIVE_FIELDS = [
  'Ticket #',
  'TicketNumber', 
  'Ticket Number',
  'License #',
  'LicenseNumber',
  'License Number',
  'Order #',
  'OrderNumber',
  'Order Number',
  'Customer #',
  'CustomerNumber',
  'Customer Number'
];

/**
 * Check if a field name is sensitive
 */
function isSensitiveField(fieldName) {
  const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, '').replace('#', 'number');
  
  for (const sensitive of SENSITIVE_FIELDS) {
    const normalizedSensitive = sensitive.toLowerCase().replace(/\s+/g, '').replace('#', 'number');
    if (normalizedFieldName === normalizedSensitive) {
      return true;
    }
  }
  
  return false;
}

/**
 * Mask a value for demo mode
 */
function maskValue(value, fieldName) {
  if (!value) return value;
  
  const valueStr = value.toString();
  
  // For ticket numbers, show first 2 and last 2 characters
  if (fieldName.toLowerCase().includes('ticket')) {
    if (valueStr.length <= 4) {
      return '*'.repeat(valueStr.length);
    }
    return valueStr.substring(0, 2) + '*'.repeat(valueStr.length - 4) + valueStr.substring(valueStr.length - 2);
  }
  
  // For license numbers, mask middle portion
  if (fieldName.toLowerCase().includes('license')) {
    if (valueStr.length <= 4) {
      return '*'.repeat(valueStr.length);
    }
    const firstChar = valueStr.substring(0, 1);
    const lastChar = valueStr.substring(valueStr.length - 1);
    return firstChar + '*'.repeat(valueStr.length - 2) + lastChar;
  }
  
  // For order/customer numbers, show first character only
  if (fieldName.toLowerCase().includes('order') || fieldName.toLowerCase().includes('customer')) {
    if (valueStr.length <= 2) {
      return '*'.repeat(valueStr.length);
    }
    return valueStr.substring(0, 1) + '*'.repeat(valueStr.length - 1);
  }
  
  // Default masking - show first and last character
  if (valueStr.length <= 2) {
    return '*'.repeat(valueStr.length);
  }
  return valueStr.substring(0, 1) + '*'.repeat(valueStr.length - 2) + valueStr.substring(valueStr.length - 1);
}

/**
 * Mask sensitive fields in extracted data
 */
export function maskExtractedFields(fields, isDemoMode) {
  if (!isDemoMode || !fields) {
    return fields;
  }
  
  const maskedFields = { ...fields };
  
  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    if (isSensitiveField(fieldName)) {
      // Handle different field structures
      if (typeof fieldValue === 'object' && fieldValue !== null) {
        // Azure field object structure
        if ('value' in fieldValue) {
          maskedFields[fieldName] = {
            ...fieldValue,
            value: maskValue(fieldValue.value, fieldName)
          };
        } else if ('content' in fieldValue) {
          maskedFields[fieldName] = {
            ...fieldValue,
            content: maskValue(fieldValue.content, fieldName)
          };
        } else if ('text' in fieldValue) {
          maskedFields[fieldName] = {
            ...fieldValue,
            text: maskValue(fieldValue.text, fieldName)
          };
        }
      } else {
        // Direct value
        maskedFields[fieldName] = maskValue(fieldValue, fieldName);
      }
    }
  }
  
  return maskedFields;
}

/**
 * Mask filename for demo mode
 */
export function maskFilename(filename, isDemoMode) {
  if (!isDemoMode || !filename) {
    return filename;
  }
  
  // Parse filename: CompanyName_TicketNumber_Date.pdf
  const parts = filename.replace('.pdf', '').split('_');
  
  if (parts.length >= 3) {
    // Keep company name, mask ticket number, keep date
    const company = parts[0];
    const ticket = parts[1];
    const date = parts.slice(2).join('_'); // In case date has underscores
    
    const maskedTicket = maskValue(ticket, 'ticket');
    return `${company}_${maskedTicket}_${date}.pdf`;
  }
  
  return filename;
}