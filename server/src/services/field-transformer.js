import { parseISO, format, parse, isValid } from 'date-fns';

/**
 * Field Transformer Service
 * Handles transformation of field values based on configured transformation types
 */
class FieldTransformer {
  /**
   * Apply transformation to a field value
   * @param {any} value - The raw value from Azure
   * @param {string} transformationType - The type of transformation to apply
   * @param {object} transformationConfig - Configuration for the transformation
   * @returns {any} - The transformed value
   */
  transform(value, transformationType, transformationConfig = {}) {
    if (!value || transformationType === 'NONE') {
      return value;
    }

    switch (transformationType) {
      case 'DATE_PARSE':
        return this.transformDate(value, transformationConfig);
      
      case 'NUMBER_FORMAT':
        return this.transformNumber(value, transformationConfig);
      
      case 'TEXT_REPLACE':
        return this.transformText(value, transformationConfig);
      
      case 'CUSTOM':
        return this.transformCustom(value, transformationConfig);
      
      default:
        return value;
    }
  }

  /**
   * Transform date values from various text formats to standard format
   * @param {string|number} value - The date value to transform
   * @param {object} config - Configuration object
   * @returns {string} - Formatted date string
   */
  transformDate(value, config = {}) {
    const {
      inputFormat = 'auto', // 'auto' will try multiple formats
      outputFormat = 'yyyy-MM-dd',
      timezone = 'UTC'
    } = config;

    // Convert to string if number
    const dateStr = String(value).trim();

    // Handle Azure text representations of dates
    // Example: "6625" might represent June 6, 2025
    if (/^\d{4,5}$/.test(dateStr)) {
      // Assume format MMDDYY or MDDYY
      let month, day, year;
      
      if (dateStr.length === 4) {
        // MDYY format
        month = parseInt(dateStr.substring(0, 1));
        day = parseInt(dateStr.substring(1, 2));
        year = 2000 + parseInt(dateStr.substring(2, 4));
      } else if (dateStr.length === 5) {
        // MMDYY format
        month = parseInt(dateStr.substring(0, 2));
        day = parseInt(dateStr.substring(2, 3));
        year = 2000 + parseInt(dateStr.substring(3, 5));
      } else if (dateStr.length === 6) {
        // MMDDYY format
        month = parseInt(dateStr.substring(0, 2));
        day = parseInt(dateStr.substring(2, 4));
        year = 2000 + parseInt(dateStr.substring(4, 6));
      }

      if (month && day && year) {
        const date = new Date(year, month - 1, day);
        if (isValid(date)) {
          return format(date, outputFormat);
        }
      }
    }

    // Try parsing with various formats
    const formats = [
      'MM/dd/yyyy',
      'dd/MM/yyyy',
      'yyyy-MM-dd',
      'MMM dd, yyyy',
      'MMMM dd, yyyy',
      'dd MMM yyyy',
      'dd MMMM yyyy',
      'MM-dd-yyyy',
      'dd-MM-yyyy',
      'MM.dd.yyyy',
      'dd.MM.yyyy',
      'yyyy/MM/dd',
      'yyyyMMdd'
    ];

    // If specific input format provided, try that first
    if (inputFormat !== 'auto') {
      try {
        const parsed = parse(dateStr, inputFormat, new Date());
        if (isValid(parsed)) {
          return format(parsed, outputFormat);
        }
      } catch (e) {
        console.warn(`Failed to parse date with format ${inputFormat}:`, e);
      }
    }

    // Try auto-detection with common formats
    for (const fmt of formats) {
      try {
        const parsed = parse(dateStr, fmt, new Date());
        if (isValid(parsed)) {
          return format(parsed, outputFormat);
        }
      } catch (e) {
        // Continue to next format
      }
    }

    // Try ISO parse as last resort
    try {
      const parsed = parseISO(dateStr);
      if (isValid(parsed)) {
        return format(parsed, outputFormat);
      }
    } catch (e) {
      // Fall through
    }

    // Return original value if parsing fails
    console.warn(`Unable to parse date value: ${value}`);
    return value;
  }

  /**
   * Transform number values with formatting
   * @param {string|number} value - The number value to transform
   * @param {object} config - Configuration object
   * @returns {string|number} - Formatted number
   */
  transformNumber(value, config = {}) {
    const {
      decimals = 2,
      thousandsSeparator = ',',
      decimalSeparator = '.',
      prefix = '',
      suffix = '',
      returnAsNumber = false
    } = config;

    // Extract numeric value
    const numStr = String(value).replace(/[^0-9.-]/g, '');
    const num = parseFloat(numStr);

    if (isNaN(num)) {
      return value;
    }

    if (returnAsNumber) {
      return Number(num.toFixed(decimals));
    }

    // Format the number
    const parts = num.toFixed(decimals).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
    const formatted = parts.join(decimalSeparator);

    return `${prefix}${formatted}${suffix}`;
  }

  /**
   * Transform text values with replacements
   * @param {string} value - The text value to transform
   * @param {object} config - Configuration object
   * @returns {string} - Transformed text
   */
  transformText(value, config = {}) {
    const {
      replacements = [],
      case: caseTransform = 'none', // 'upper', 'lower', 'title', 'none'
      trim = true
    } = config;

    let result = String(value);

    // Apply trimming
    if (trim) {
      result = result.trim();
    }

    // Apply replacements
    for (const { from, to, regex = false } of replacements) {
      if (regex) {
        result = result.replace(new RegExp(from, 'g'), to);
      } else {
        result = result.split(from).join(to);
      }
    }

    // Apply case transformation
    switch (caseTransform) {
      case 'upper':
        result = result.toUpperCase();
        break;
      case 'lower':
        result = result.toLowerCase();
        break;
      case 'title':
        result = result.replace(/\w\S*/g, txt => 
          txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
        break;
    }

    return result;
  }

  /**
   * Apply custom transformation using JavaScript expression
   * @param {any} value - The value to transform
   * @param {object} config - Configuration object
   * @returns {any} - Transformed value
   */
  transformCustom(value, config = {}) {
    const { expression = 'value' } = config;

    try {
      // Create a safe evaluation context
      const context = {
        value,
        Date,
        Math,
        String,
        Number,
        Boolean,
        parseInt,
        parseFloat,
        isNaN,
        isFinite
      };

      // Use Function constructor for safer evaluation
      const func = new Function(...Object.keys(context), `return ${expression}`);
      return func(...Object.values(context));
    } catch (e) {
      console.error('Custom transformation error:', e);
      return value;
    }
  }

  /**
   * Validate transformation configuration
   * @param {string} transformationType - The type of transformation
   * @param {object} transformationConfig - The configuration to validate
   * @returns {object} - Validation result { valid: boolean, errors: string[] }
   */
  validateConfig(transformationType, transformationConfig = {}) {
    const errors = [];

    switch (transformationType) {
      case 'DATE_PARSE':
        if (transformationConfig.inputFormat && transformationConfig.inputFormat !== 'auto') {
          // Validate format string
          try {
            format(new Date(), transformationConfig.inputFormat);
          } catch (e) {
            errors.push('Invalid input date format');
          }
        }
        if (transformationConfig.outputFormat) {
          try {
            format(new Date(), transformationConfig.outputFormat);
          } catch (e) {
            errors.push('Invalid output date format');
          }
        }
        break;

      case 'NUMBER_FORMAT':
        if (transformationConfig.decimals !== undefined && 
            (!Number.isInteger(transformationConfig.decimals) || transformationConfig.decimals < 0)) {
          errors.push('Decimals must be a non-negative integer');
        }
        break;

      case 'TEXT_REPLACE':
        if (transformationConfig.replacements && !Array.isArray(transformationConfig.replacements)) {
          errors.push('Replacements must be an array');
        }
        break;

      case 'CUSTOM':
        if (!transformationConfig.expression) {
          errors.push('Custom transformation requires an expression');
        }
        break;
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default new FieldTransformer();