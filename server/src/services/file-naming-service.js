import { format, parse } from 'date-fns';

export class FileNamingService {
  /**
   * Parse template and extract variable names
   * @param {string} template - Template string with {variable} placeholders
   * @returns {string[]} - Array of variable names
   */
  parseTemplate(template) {
    const regex = /{(\w+)}/g;
    const variables = [];
    let match;
    
    while ((match = regex.exec(template)) !== null) {
      variables.push(match[1]);
    }
    
    return [...new Set(variables)]; // Remove duplicates
  }
  
  /**
   * Apply transformation to a field value
   * @param {string} value - Raw field value
   * @param {string} transform - Transformation specification
   * @returns {string} - Transformed value
   */
  applyTransform(value, transform) {
    if (!transform || !value) return value;
    
    // Handle null/undefined
    if (value === null || value === undefined) return '';
    
    // Convert to string
    const strValue = String(value);
    
    // Parse transform type and parameters
    const [type, ...params] = transform.split(':');
    
    switch (type) {
      case 'uppercase':
        return strValue.toUpperCase();
        
      case 'lowercase':
        return strValue.toLowerCase();
        
      case 'camelcase':
        return this.toCamelCase(strValue);
        
      case 'kebabcase':
        return this.toKebabCase(strValue);
        
      case 'date': {
        let dateFormat = params[0] || 'yyyy-MM-dd';
        // Convert our custom format strings to date-fns format
        // Handle month names first to avoid conflicts
        dateFormat = dateFormat
          .replace(/MMMM/g, 'MMMM')  // Full month name (January)
          .replace(/MMM/g, 'MMM')     // Short month name (Jan)
          .replace(/MM/g, 'MM')       // Month number (01-12)
          .replace(/DD/g, 'dd')       // Day with leading zero
          .replace(/YYYY/g, 'yyyy');  // 4-digit year
        return this.formatDateValue(strValue, dateFormat);
      }
        
      case 'truncate': {
        const length = parseInt(params[0]) || 50;
        return strValue.substring(0, length);
      }
        
      case 'replace': {
        if (params.length >= 2) {
          const [searchValue, replaceValue] = params;
          return strValue.replace(new RegExp(searchValue, 'g'), replaceValue || '');
        }
        return strValue;
      }
        
      default:
        return strValue;
    }
  }
  
  /**
   * Convert string to camelCase
   */
  toCamelCase(str) {
    return str
      .replace(/[^a-zA-Z0-9]+(.)/g, (match, chr) => chr.toUpperCase())
      .replace(/^./, (match) => match.toLowerCase());
  }
  
  /**
   * Convert string to kebab-case
   */
  toKebabCase(str) {
    return str
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/^-|-$/g, '');
  }
  
  /**
   * Format date value
   */
  formatDateValue(dateStr, dateFormat) {
    try {
      console.log(`[DATE FORMAT] Input: "${dateStr}", Format: "${dateFormat}"`);
      
      // Try parsing as ISO date first
      let date = new Date(dateStr);
      console.log(`[DATE FORMAT] Direct parse result: ${date}`);
      
      if (isNaN(date.getTime())) {
        // Try common date formats
        const formats = [
          'MM/dd/yyyy',
          'dd/MM/yyyy',
          'yyyy-MM-dd',
          'MM-dd-yyyy',
          'dd-MM-yyyy'
        ];
        
        for (const fmt of formats) {
          try {
            date = parse(dateStr, fmt, new Date());
            if (!isNaN(date.getTime())) {
              console.log(`[DATE FORMAT] Parsed with format ${fmt}: ${date}`);
              break;
            }
          } catch (e) {
            // Continue to next format
          }
        }
      }
      
      if (!isNaN(date.getTime())) {
        const formatted = format(date, dateFormat);
        console.log(`[DATE FORMAT] Final formatted date: ${formatted}`);
        return formatted;
      }
      
      // If still invalid, return original
      console.log(`[DATE FORMAT] Could not parse date, returning original: ${dateStr}`);
      return dateStr;
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateStr;
    }
  }
  
  /**
   * Extract field value from job data
   */
  extractFieldValue(extractedFields, fieldName) {
    if (!extractedFields || !fieldName) return '';
    
    const field = extractedFields[fieldName];
    
    if (!field) return '';
    
    // Handle different field structures from Azure
    if (typeof field === 'string' || typeof field === 'number') {
      return String(field);
    }
    
    if (field && typeof field === 'object') {
      // Check common properties
      if (field.value !== undefined) return String(field.value);
      if (field.content !== undefined) return String(field.content);
      if (field.text !== undefined) return String(field.text);
      if (field.valueString !== undefined) return String(field.valueString);
      if (field.valueData !== undefined) return String(field.valueData);
    }
    
    return '';
  }
  
  /**
   * Generate filename from template and field mappings (old format)
   * @param {string} template - File naming template
   * @param {object} fieldMappings - Mapping of variables to fields
   * @param {object} extractedFields - Extracted field data from job
   * @returns {string} - Generated filename (without extension)
   */
  generateFileName(template, fieldMappings, extractedFields) {
    if (!template) return null;
    
    let fileName = template;
    
    // Extract variables from template
    const variables = this.parseTemplate(template);
    
    // Replace each variable
    for (const variable of variables) {
      const mapping = fieldMappings?.[variable];
      
      if (!mapping) {
        // No mapping for this variable, use placeholder
        fileName = fileName.replace(new RegExp(`{${variable}}`, 'g'), variable);
        continue;
      }
      
      // Extract field value
      const rawValue = this.extractFieldValue(extractedFields, mapping.fieldName);
      
      // Apply transformation
      const transformed = mapping.transform 
        ? this.applyTransform(rawValue, mapping.transform)
        : rawValue;
      
      // Use fallback if empty
      const finalValue = transformed || mapping.fallback || 'Unknown';
      
      // Sanitize and replace
      const sanitized = this.sanitizeForFilename(finalValue);
      fileName = fileName.replace(new RegExp(`{${variable}}`, 'g'), sanitized);
    }
    
    return fileName;
  }
  
  /**
   * Generate filename from elements array (new format)
   * @param {array} elements - Array of template elements
   * @param {object} extractedFields - Extracted field data from job
   * @returns {string} - Generated filename (without extension)
   */
  generateFileNameFromElements(elements, extractedFields) {
    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return null;
    }
    
    let fileName = '';
    
    for (const element of elements) {
      if (element.type === 'text') {
        // Add text element directly
        fileName += element.value || '';
      } else if (element.type === 'field') {
        // Extract field value
        const rawValue = this.extractFieldValue(extractedFields, element.fieldName);
        
        // Apply transformation
        const transformed = element.transform 
          ? this.applyTransform(rawValue, element.transform)
          : rawValue;
        
        // Use field name as fallback if empty
        const finalValue = transformed || element.fieldName || 'Unknown';
        
        // Sanitize and add
        const sanitized = this.sanitizeForFilename(finalValue);
        fileName += sanitized;
      }
    }
    
    return fileName || null;
  }
  
  /**
   * Sanitize string for use in filename
   * @param {string} str - String to sanitize
   * @returns {string} - Sanitized string
   */
  sanitizeForFilename(str) {
    return str
      .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace invalid chars with underscore
      .replace(/_+/g, '_')              // Replace multiple underscores with single
      .replace(/^_|_$/g, '')            // Remove leading/trailing underscores
      .substring(0, 50);                // Limit length
  }
}

// Export singleton instance
export default new FileNamingService();