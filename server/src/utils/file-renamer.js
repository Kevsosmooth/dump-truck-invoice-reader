export function generateFileName(extractedData) {
  // Extract company name, ticket number, and date from the data
  let companyName = 'Unknown_Company';
  let ticketNumber = 'NoTicket';
  let date = new Date().toISOString().split('T')[0];
  
  // Try to find company name in various fields
  const companyFields = ['CustomerName', 'VendorName', 'CompanyName', 'Supplier', 'Customer', 'BillTo', 'ShipTo'];
  for (const field of companyFields) {
    if (extractedData[field]?.value) {
      companyName = extractedData[field].value;
      break;
    }
  }
  
  // Try to find ticket/invoice number
  const ticketFields = ['TicketNumber', 'InvoiceNumber', 'InvoiceId', 'DocumentNumber', 'TicketNo', 'InvoiceNo', 'OrderNumber'];
  for (const field of ticketFields) {
    if (extractedData[field]?.value) {
      ticketNumber = extractedData[field].value;
      break;
    }
  }
  
  // Try to find date
  const dateFields = ['InvoiceDate', 'Date', 'DocumentDate', 'TransactionDate', 'DueDate'];
  for (const field of dateFields) {
    if (extractedData[field]?.value) {
      try {
        const parsedDate = new Date(extractedData[field].value);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate.toISOString().split('T')[0];
        }
      } catch (e) {
        // Keep default date if parsing fails
      }
      break;
    }
  }
  
  // Clean up the values for file naming
  companyName = companyName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_').substring(0, 50);
  ticketNumber = ticketNumber.replace(/[^a-zA-Z0-9]/g, '').substring(0, 20);
  
  return `${companyName}_Ticket${ticketNumber}_${date}.pdf`;
}