const db = require('better-sqlite3')('/home/shivam/Desktop/OCR/receipt-parser/backend/receipts.db');
console.log(db.prepare('SELECT error FROM parse_attempts ORDER BY id DESC LIMIT 5').all());
