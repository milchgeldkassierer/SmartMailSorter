const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const os = require('os');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'smartmail-ai-sorter-gmx-style', 'smartmail.db');
console.log('Target DB Path:', dbPath);

if (!fs.existsSync(dbPath)) {
  console.error('ERROR: Database file does not exist at path!');
} else {
  try {
    const db = new Database(dbPath, { verbose: null, fileMustExist: true });

    console.log('\n--- CATEGORIES TABLE ---');
    try {
      const categories = db.prepare('SELECT * FROM categories').all();
      console.table(categories);
    } catch (e) {
      console.error('Error reading categories:', e.message);
    }

    console.log('\n--- EMAILS FOLDER DISTRIBUTION ---');
    try {
      const counts = db.prepare('SELECT folder, count(*) as c FROM emails GROUP BY folder').all();
      console.table(counts);
    } catch (_e) {
      // Ignore query errors
    }
  } catch (e) {
    console.error('Failed to open database:', e);
  }
}
