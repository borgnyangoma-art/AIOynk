# Database Setup Guide

## Prerequisites
- PostgreSQL 15+ installed locally or via Docker
- Redis 7+ installed locally or via Docker

## Setup with Docker

1. Start services:
```bash
docker-compose up -d postgres redis
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Run schema migrations (uses Knex under the hood):
```bash
npm run db:migrate
```

5. Seed the database (optional):
```bash
npm run db:seed
```

## Manual Database Setup

1. Create database:
```bash
createdb aio
```

2. Run migrations:
```bash
npm run db:migrate
```

3. (Optional) Seed local data:
```bash
npm run db:seed
```

## Useful Commands

- `npx knex migrate:latest --knexfile apps/backend/knexfile.js` - Apply the latest migrations manually
- `npx knex migrate:rollback --knexfile apps/backend/knexfile.js` - Roll back the previous migration
- `npx knex seed:run --knexfile apps/backend/knexfile.js` - Run seeds directly
- `npm run db:migrate` / `npm run db:seed` - Workspace-aware wrappers for the commands above

## Schema Changes

When updating the database schema:

1. Create a new migration from the backend workspace:
   ```bash
   cd apps/backend
   npx knex migrate:make descriptive_name
   ```
2. Implement the `up`/`down` changes in the generated file under `apps/backend/migrations`.
3. Run `npm run db:migrate` to verify the migration against your local database.
4. Commit the migration file together with any related application changes.

## Production Deployment

1. Set production DATABASE_URL environment variable
2. Run: `npm run db:migrate`
3. Seed only if required: `npm run db:seed`
