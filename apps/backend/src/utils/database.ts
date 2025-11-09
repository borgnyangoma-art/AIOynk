import knex, { Knex } from 'knex';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const knexConfig = require('../../knexfile') as Record<string, Knex.Config>;
import metricsService from '../services/metrics.service';
import logger from '../services/logger.service';

const env = process.env.NODE_ENV || 'development';

const db = knex(knexConfig[env]);
type QueryEvent = {
  __knexUid: string;
  sql: string;
  bindings?: readonly any[];
  method?: string;
  table?: string;
};

const queryTimers = new Map<string, [number, number]>();

const toSeconds = (hrtime: [number, number]) =>
  hrtime[0] + hrtime[1] / 1_000_000_000;

const extractTableName = (sql: string): string => {
  const fromMatch = sql.match(/\bfrom\s+("?[\w.-]+"?)/i);
  if (fromMatch?.[1]) {
    return fromMatch[1].replace(/"/g, '');
  }
  const intoMatch = sql.match(/\binto\s+("?[\w.-]+"?)/i);
  if (intoMatch?.[1]) {
    return intoMatch[1].replace(/"/g, '');
  }
  return 'unknown';
};

const recordQueryMetrics = (query: QueryEvent, error?: Error) => {
  const start = queryTimers.get(query.__knexUid);
  if (!start) {
    return;
  }

  queryTimers.delete(query.__knexUid);
  const duration = toSeconds(process.hrtime(start));
  const queryType = (query.method || query.sql.split(' ')[0] || 'query').toLowerCase();
  const table = query.table || extractTableName(query.sql);

  metricsService.recordDbQuery(queryType, table, duration, error?.message);

  if (!error && duration > 1) {
    logger.warn('Slow database query detected', {
      queryType,
      table,
      durationMs: Number((duration * 1000).toFixed(2)),
      preview: query.sql.slice(0, 120),
    });
  }
};

db.on('query', (query: QueryEvent) => {
  queryTimers.set(query.__knexUid, process.hrtime());
});

db.on('query-response', (_response: unknown, query: QueryEvent) => {
  recordQueryMetrics(query);
});

db.on('query-error', (error: Error, query: QueryEvent) => {
  recordQueryMetrics(query, error);
  logger.error('Database query failed', error);
});

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
