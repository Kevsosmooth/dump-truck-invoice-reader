// Test Excel serial date conversion
console.log('Testing Excel serial date conversion...\n');

function parseExcelDate(dateStr) {
  // Handle numeric values (Excel serial dates)
  const numericMatch = dateStr.toString().trim().match(/^[\s"']*(\d+)[\s"']*$/);
  if (numericMatch || /^\d+$/.test(dateStr)) {
    const numericValue = parseInt(numericMatch ? numericMatch[1] : dateStr);
    
    // Excel serial date
    if (numericValue > 0 && numericValue < 100000) {
      const excelEpoch = new Date(1899, 11, 30); // December 30, 1899
      const msPerDay = 24 * 60 * 60 * 1000;
      const jsDate = new Date(excelEpoch.getTime() + numericValue * msPerDay);
      
      if (jsDate.getFullYear() > 1900 && jsDate.getFullYear() < 2100) {
        return jsDate.toISOString().split('T')[0];
      }
    }
  }
  return null;
}

// Test cases
const testCases = [
  "6525",           // String number
  6525,             // Actual number
  '"6525"',         // Quoted string
  " 6525 ",         // Padded with spaces
  "'6525'",         // Single quoted
  "45292",          // Dec 31, 2023
  "44927",          // Dec 31, 2022
  "1",              // Jan 1, 1900
  "44197",          // Jan 1, 2021
];

console.log('Excel Date Serial Number Conversions:');
console.log('=====================================');

testCases.forEach(testValue => {
  const result = parseExcelDate(testValue);
  console.log(`Input: "${testValue}" -> ${result || 'Failed to parse'}`);
});

// Specifically test 6525
console.log('\nDetailed test for 6525:');
const excelSerial = 6525;
const excelEpoch = new Date(1899, 11, 30);
const msPerDay = 24 * 60 * 60 * 1000;
const resultDate = new Date(excelEpoch.getTime() + excelSerial * msPerDay);
console.log(`Excel serial 6525 = ${resultDate.toISOString().split('T')[0]} (${resultDate.toDateString()})`);