import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Test the date parsing logic with various formats
function testDateParsing() {
  const testDates = [
    "June 06, 2025",
    "06/06/2025",
    "6/6/2025",
    "2025-06-06",
    "06-06-2025",
    "June 6, 2025",
    "Jun 06, 2025",
    "06 June 2025",
    "2025/06/06",
    "06.06.2025",
    "Invalid Date",
    "",
    null,
    undefined,
    { value: "June 06, 2025" },
    { content: "06/06/2025" },
    { valueString: "2025-06-06" },
    { valueDate: "2025-06-06T00:00:00Z" },
    { text: "June 6, 2025" }
  ];

  console.log('Testing date parsing with various formats:\n');

  testDates.forEach(dateInput => {
    const extracted = extractFieldValue(dateInput);
    const formatted = formatDate(extracted);
    console.log(`Input: ${JSON.stringify(dateInput)}`);
    console.log(`Extracted: ${extracted}`);
    console.log(`Formatted: ${formatted}`);
    console.log('---');
  });
}

// Copy of the extractFieldValue function from post-processor
function extractFieldValue(field) {
  if (typeof field === 'string') {
    return field;
  }
  if (field && typeof field === 'object') {
    // Azure Form Recognizer sometimes returns nested structures
    if (field.value !== undefined) {
      return field.value;
    }
    if (field.content !== undefined) {
      return field.content;
    }
    if (field.text !== undefined) {
      return field.text;
    }
    // Sometimes the value is in a valueString property
    if (field.valueString !== undefined) {
      return field.valueString;
    }
    // For date fields, Azure might return valueDate
    if (field.valueDate !== undefined) {
      return field.valueDate;
    }
    // Check for nested value object
    if (field.value && typeof field.value === 'object') {
      return extractFieldValue(field.value);
    }
  }
  return '';
}

// Copy of the formatDate function from post-processor
function formatDate(dateStr) {
  try {
    if (!dateStr || dateStr === '') {
      return new Date().toISOString().split('T')[0];
    }
    
    // Handle various date formats
    let parsedDate = null;
    
    // Try ISO format first
    parsedDate = new Date(dateStr);
    if (!isNaN(parsedDate.getTime()) && parsedDate.getFullYear() > 1900) {
      return parsedDate.toISOString().split('T')[0];
    }
    
    // Try MM/DD/YYYY or MM-DD-YYYY
    const usFormat = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (usFormat) {
      const month = usFormat[1].padStart(2, '0');
      const day = usFormat[2].padStart(2, '0');
      const year = usFormat[3];
      return `${year}-${month}-${day}`;
    }
    
    // Try DD/MM/YYYY or DD-MM-YYYY
    const euFormat = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (euFormat) {
      const day = euFormat[1].padStart(2, '0');
      const month = euFormat[2].padStart(2, '0');
      const year = euFormat[3];
      // Validate month is 1-12
      if (parseInt(month) <= 12) {
        return `${year}-${month}-${day}`;
      }
    }
    
    // Try Month DD, YYYY format (e.g., "June 06, 2025")
    const monthNameFormat = dateStr.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
    if (monthNameFormat) {
      const monthName = monthNameFormat[1];
      const day = monthNameFormat[2].padStart(2, '0');
      const year = monthNameFormat[3];
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                         'July', 'August', 'September', 'October', 'November', 'December'];
      const monthIndex = monthNames.findIndex(m => m.toLowerCase().startsWith(monthName.toLowerCase()));
      if (monthIndex !== -1) {
        const month = (monthIndex + 1).toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
    
    // Try YYYY-MM-DD format
    const isoFormat = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoFormat) {
      return dateStr.substring(0, 10);
    }
    
    // Try to extract just numbers and guess format
    const numbers = dateStr.match(/\d+/g);
    if (numbers && numbers.length >= 3) {
      // Assume first is month, second is day, third is year if year is 4 digits
      if (numbers[2].length === 4) {
        const month = numbers[0].padStart(2, '0');
        const day = numbers[1].padStart(2, '0');
        const year = numbers[2];
        if (parseInt(month) <= 12 && parseInt(day) <= 31) {
          return `${year}-${month}-${day}`;
        }
      }
    }
    
    // Default to today's date if parsing fails
    console.log(`Could not parse date: ${dateStr}, using today's date`);
    return new Date().toISOString().split('T')[0];
  } catch (error) {
    console.error(`Error formatting date: ${dateStr}`, error);
    return new Date().toISOString().split('T')[0];
  }
}

// Check actual field structures from recent jobs
async function checkActualFieldStructures() {
  try {
    console.log('\n\nChecking actual field structures from recent jobs:\n');
    
    // Get recent completed jobs with extracted fields
    const recentJobs = await prisma.job.findMany({
      where: {
        status: 'COMPLETED',
        extractedFields: { not: null }
      },
      orderBy: { completedAt: 'desc' },
      take: 5
    });

    for (const job of recentJobs) {
      console.log(`\nJob: ${job.fileName} (ID: ${job.id})`);
      console.log('Extracted Fields:');
      
      const fields = job.extractedFields;
      
      // Look for date-related fields
      const dateFieldNames = Object.keys(fields).filter(key => 
        key.toLowerCase().includes('date') || 
        key.toLowerCase().includes('time')
      );
      
      if (dateFieldNames.length > 0) {
        dateFieldNames.forEach(fieldName => {
          const fieldValue = fields[fieldName];
          console.log(`\n  Field: ${fieldName}`);
          console.log(`  Raw Value: ${JSON.stringify(fieldValue, null, 2)}`);
          console.log(`  Extracted: ${extractFieldValue(fieldValue)}`);
          console.log(`  Formatted: ${formatDate(extractFieldValue(fieldValue))}`);
        });
      } else {
        console.log('  No date fields found in this job');
      }
      
      // Also show all field names for reference
      console.log(`\n  All fields: ${Object.keys(fields).join(', ')}`);
    }
    
  } catch (error) {
    console.error('Error checking field structures:', error);
  }
}

// Run tests
async function main() {
  testDateParsing();
  await checkActualFieldStructures();
  await prisma.$disconnect();
}

main();