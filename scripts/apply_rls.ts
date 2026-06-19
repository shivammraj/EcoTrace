import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Reading enable_rls.sql...');
  const sqlPath = path.join(__dirname, '../prisma/migrations/enable_rls.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('Applying RLS migrations directly to the database...');
  
  // 1. Remove line comments (-- ...)
  const noLineComments = sql
    .split('\n')
    .map(line => {
      const index = line.indexOf('--');
      return index !== -1 ? line.substring(0, index) : line;
    })
    .join('\n');

  // 2. Split statements by semicolon
  const statements = noLineComments
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  for (const statement of statements) {
    try {
      console.log(`Executing:\n${statement}\n`);
      await prisma.$executeRawUnsafe(statement);
    } catch (e: any) {
      if (e.message && (e.message.includes('already exists') || e.message.includes('42710'))) {
        console.log(`--> Policy already exists. Skipping.`);
      } else {
        throw e;
      }
    }
  }

  console.log('RLS applied successfully.');
}

main()
  .catch(e => {
    console.error('Failed to apply RLS migrations:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
