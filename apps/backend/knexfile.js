require('dotenv').config();

module.exports = {
  development: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'aio',
      password: process.env.DB_PASSWORD || 'aio_password',
      database: process.env.DB_NAME || 'aio_creative_hub',
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
    },
    pool: {
      min: 2,
      max: 10,
    },
  },

  test: {
    client: 'postgresql',
    connection: {
      host: process.env.DB_HOST_TEST || 'localhost',
      port: process.env.DB_PORT_TEST || 5432,
      user: process.env.DB_USER_TEST || 'aio',
      password: process.env.DB_PASSWORD_TEST || 'aio_password',
      database: process.env.DB_NAME_TEST || 'aio_creative_hub_test',
    },
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
    },
  },

  production: {
    client: 'postgresql',
    connection: process.env.DATABASE_URL,
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations',
    },
    seeds: {
      directory: './seeds',
    },
    pool: {
      min: 2,
      max: 20,
    },
  },
};
