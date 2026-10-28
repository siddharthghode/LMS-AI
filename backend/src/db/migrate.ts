import fs from 'fs';
import path from 'path';
import { pool } from '../config/db';

export async function runMigrations() {
  console.log('Running database migrations...');
  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    console.log(`Applying migration: ${file}`);
    const sql = fs.readFileSync(filePath, 'utf8');
    await pool.query(sql);
  }
  console.log('All migrations applied successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}
