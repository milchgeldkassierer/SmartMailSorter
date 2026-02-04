const Database = require('better-sqlite3');
const path = require('path');

// Hardcoded path for dev environment
const dbPath = path.join('d:/projects/SmartMailSorter', 'smartmail.db');
const db = new Database(dbPath);

console.log('Checking unread counts per folder...');

const rows = db
  .prepare(
    `
    SELECT folder, count(*) as c 
    FROM emails 
    WHERE isRead = 0 
    GROUP BY folder
`
  )
  .all();

console.log('Unread Counts per Folder:');
rows.forEach((r) => console.log(`${r.folder}: ${r.c}`));

// Check specifically Posteingang
const inbox = rows.find((r) => r.folder === 'Posteingang');
if (!inbox) {
  console.log('Posteingang has 0 unread emails.');
} else {
  console.log('Posteingang has ' + inbox.c + ' unread emails.');
}
