import knex from 'knex';
import knexConfig from '../../knexfile';

const env = process.env.NODE_ENV || 'development';

const db = knex(knexConfig[env]);

export default db;

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await db.raw('SELECT 1');
    console.log('✅ Database connection established');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

export async function closeDatabaseConnection(): Promise<void> {
  await db.destroy();
  console.log('🔒 Database connection closed');
}
