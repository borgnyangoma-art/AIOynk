/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema
    // Users table
    .createTable('users', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.string('email').notNullable().unique();
      table.string('password_hash').nullable();
      table.string('first_name').notNullable();
      table.string('last_name').notNullable();
      table.string('google_id').nullable().unique();
      table.string('google_access_token').nullable();
      table.string('google_refresh_token').nullable();
      table.timestamp('google_token_expires_at').nullable();
      table.string('avatar_url').nullable();
      table.enum('role', ['user', 'admin', 'moderator']).defaultTo('user');
      table.boolean('email_verified').defaultTo(false);
      table.timestamp('email_verified_at').nullable();
      table.integer('failed_login_attempts').defaultTo(0);
      table.timestamp('locked_until').nullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
    })

    // Sessions table for JWT refresh tokens
    .createTable('sessions', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('refresh_token_hash').notNullable();
      table.string('device_info').nullable();
      table.string('ip_address').nullable();
      table.timestamp('expires_at').notNullable();
      table.timestamp('revoked_at').nullable();
      table.string('revoked_reason').nullable();
      table.timestamps(true, true);
      table.index(['user_id']);
      table.index(['expires_at']);
    })

    // Projects table
    .createTable('projects', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('name').notNullable();
      table.text('description').nullable();
      table.enum('tool_type', ['graphics', 'web_designer', 'ide', 'cad', 'video']).notNullable();
      table.jsonb('data').nullable();
      table.string('status').defaultTo('draft');
      table.string('thumbnail_url').nullable();
      table.timestamp('last_edited_at').nullable();
      table.timestamps(true, true);
      table.index(['user_id']);
      table.index(['tool_type']);
      table.index(['status']);
    })

    // Artifacts table for created content
    .createTable('artifacts', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('project_id').notNullable().references('id').inTable('projects').onDelete('CASCADE');
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('name').notNullable();
      table.string('type').notNullable();
      table.string('mime_type').notNullable();
      table.bigInteger('file_size').notNullable();
      table.string('file_path'). nullable();
      table.string('storage_provider').defaultTo('local');
      table.string('google_drive_id').nullable();
      table.jsonb('metadata').nullable();
      table.integer('version').defaultTo(1);
      table.boolean('is_public').defaultTo(false);
      table.timestamps(true, true);
      table.index(['project_id']);
      table.index(['user_id']);
      table.index(['type']);
    })

    // Messages table for chat history
    .createTable('messages', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.uuid('project_id').nullable().references('id').inTable('projects').onDelete('SET NULL');
      table.enum('sender', ['user', 'assistant', 'system']).notNullable();
      table.text('content').notNullable();
      table.jsonb('context').nullable();
      table.jsonb('tool_result').nullable();
      table.string('tool_name').nullable();
      table.integer('token_count').nullable();
      table.timestamps(true, true);
      table.index(['user_id']);
      table.index(['project_id']);
      table.index(['created_at']);
    })

    // User preferences table
    .createTable('user_preferences', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.jsonb('preferences').notNullable().defaultTo('{}');
      table.timestamps(true, true);
      table.unique(['user_id']);
    })

    // Audit logs table
    .createTable('audit_logs', function(table) {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('user_id').nullable().references('id').inTable('users').onDelete('SET NULL');
      table.string('action').notNullable();
      table.string('resource_type').notNullable();
      table.uuid('resource_id').nullable();
      table.jsonb('old_values').nullable();
      table.jsonb('new_values').nullable();
      table.string('ip_address').nullable();
      table.string('user_agent').nullable();
      table.timestamps(true, true);
      table.index(['user_id']);
      table.index(['action']);
      table.index(['resource_type', 'resource_id']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema
    .dropTableIfExists('audit_logs')
    .dropTableIfExists('user_preferences')
    .dropTableIfExists('messages')
    .dropTableIfExists('artifacts')
    .dropTableIfExists('projects')
    .dropTableIfExists('sessions')
    .dropTableIfExists('users');
};
