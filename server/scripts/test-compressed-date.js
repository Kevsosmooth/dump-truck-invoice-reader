// Test compressed date parsing
console.log('Testing compressed date parsing...\n');

function parseCompressedDate(dateStr) {
  const numericMatch = dateStr.toString().trim().match(/^[\s"']*(\d+)[\s"']*$/);
  if (numericMatch || /^\d+$/.test(dateStr)) {
    const numericValue = parseInt(numericMatch ? numericMatch[1] : dateStr);
    const numericStr = numericValue.toString();
    
    // Check for compressed date formats first (e.g., 6525 = 6/5/25)
    if (numericStr.length === 3 || numericStr.length === 4 || numericStr.length === 5) {
      let month, day, year;
      
      if (numericStr.length === 3) {
        month = parseInt(numericStr.substring(0, 1));
        day = 1;
        year = 2000 + parseInt(numericStr.substring(1, 3));
      } else if (numericStr.length === 4) {
        const firstTwo = parseInt(numericStr.substring(0, 2));
        if (firstTwo <= 12) {
          month = firstTwo;
          day = 1;
          year = 2000 + parseInt(numericStr.substring(2, 4));
        } else {
          month = parseInt(numericStr.substring(0, 1));
          day = parseInt(numericStr.substring(1, 2));
          year = 2000 + parseInt(numericStr.substring(2, 4));
        }
      } else if (numericStr.length === 5) {
        const firstTwo = parseInt(numericStr.substring(0, 2));
        if (firstTwo <= 12) {
          month = firstTwo;
          day = parseInt(numericStr.substring(2, 3));
          year = 2000 + parseInt(numericStr.substring(3, 5));
        } else {
          month = parseInt(numericStr.substring(0, 1));
          day = parseInt(numericStr.substring(1, 3));
          year = 2000 + parseInt(numericStr.substring(3, 5));
        }
      }
      
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31 && year >= 2000 && year <= 2099) {
        const parsedDate = new Date(year, month - 1, day);
        if (!isNaN(parsedDate.getTime())) {
          return {
            parsed: parsedDate.toISOString().split('T')[0],
            interpretation: `${month}/${day}/${year}`
          };
        }
      }
    }
  }
  return null;
}

// Test cases
const testCases = [
  "6525",    // 6/5/25
  "625",     // 6/25 (year assumed 2025)
  "1225",    // 12/25 or 1/2/25
  "12125",   // 12/1/25 or 1/21/25
  "10524",   // 10/5/24 or 1/05/24
  "324",     // 3/24
  "1124",    // 11/24
  "6123",    // 6/1/23
  "61223",   // 6/12/23
];

console.log('Compressed Date Conversions:');
console.log('=============================');

testCases.forEach(testValue => {
  const result = parseCompressedDate(testValue);
  if (result) {
    console.log(`Input: "${testValue}" -> ${result.parsed} (interpreted as ${result.interpretation})`);
  } else {
    console.log(`Input: "${testValue}" -> Failed to parse`);
  }
});