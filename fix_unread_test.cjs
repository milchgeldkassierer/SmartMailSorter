const Database = require('better-sqlite3');
const path = require('path');
const { app } = require('electron');

// Hardcoded path for dev environment
const dbPath = path.join('d:/projects/SmartMailSorter', 'smartmail.db');
const db = new Database(dbPath);

console.log('Setting 50 random emails to isRead = 0 (Unread)...');

const result = db
  .prepare(
    `
    UPDATE emails 
    SET isRead = 0 
    WHERE id IN (SELECT id FROM emails ORDER BY RANDOM() LIMIT 50)
`
  )
  .run();

console.log(`Updated ${result.changes} emails to unread.`);
