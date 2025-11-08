/**
 * Database Seed Script
 * Seeds the database with test data using Knex
 */

import knex from 'knex';
import config from '../utils/config';

// Initialize Knex
const db = knex({
  client: 'pg',
  connection: {
    host: config.DB_HOST,
    port: parseInt(config.DB_PORT || '5432'),
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
  },
  pool: {
    min: 2,
    max: 10,
  },
});

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Clean existing data (in reverse order due to foreign keys)
    await db('audit_logs').del();
    await db('user_preferences').del();
    await db('messages').del();
    await db('artifacts').del();
    await db('projects').del();
    await db('sessions').del();
    await db('users').del();

    console.log('✅ Cleaned existing data');

    // Create test user
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash('password123', 12);

    const [testUser] = await db('users')
      .insert({
        email: 'test@example.com',
        password_hash: hashedPassword,
        first_name: 'Test',
        last_name: 'User',
        role: 'user',
        email_verified: true,
        email_verified_at: new Date(),
        is_active: true,
      })
      .returning('*');

    console.log(`✅ Created test user: ${testUser.email}`);

    // Create user preferences
    await db('user_preferences').insert({
      user_id: testUser.id,
      preferences: {
        theme: 'light',
        language: 'en',
        notifications: true,
      },
    });

    console.log(`✅ Created user preferences for: ${testUser.email}`);

    // Create test project
    const [testProject] = await db('projects')
      .insert({
        user_id: testUser.id,
        name: 'My First Project',
        description: 'A test project to get started',
        tool_type: 'graphics',
        data: {
          canvas: { width: 800, height: 600 },
          elements: [],
        },
        status: 'active',
        last_edited_at: new Date(),
      })
      .returning('*');

    console.log(`✅ Created test project: ${testProject.name}`);

    // Create test session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const [testSession] = await db('sessions')
      .insert({
        user_id: testUser.id,
        refresh_token_hash: 'hash_' + Date.now(),
        device_info: 'Chrome on Windows',
        ip_address: '127.0.0.1',
        expires_at: expiresAt,
      })
      .returning('*');

    console.log(`✅ Created test session: ${testSession.id}`);

    // Create test messages
    const [message1] = await db('messages')
      .insert({
        user_id: testUser.id,
        project_id: testProject.id,
        sender: 'user',
        content: 'Hello! I want to create a logo for my project.',
        context: {
          intent: {
            tool: 'graphics',
            action: 'create',
            parameters: { type: 'logo' },
            confidence: 0.95,
          },
        },
        token_count: 15,
      })
      .returning('*');

    const [message2] = await db('messages')
      .insert({
        user_id: testUser.id,
        project_id: testProject.id,
        sender: 'assistant',
        content: 'I\'ll help you create a logo. What style are you looking for?',
        context: {
          intent: {
            tool: 'graphics',
            action: 'inquire',
            parameters: { type: 'logo' },
            confidence: 0.98,
          },
        },
        token_count: 22,
      })
      .returning('*');

    console.log(`✅ Created test messages: ${message1.id}, ${message2.id}`);

    // Create test artifact
    const [testArtifact] = await db('artifacts')
      .insert({
        project_id: testProject.id,
        user_id: testUser.id,
        name: 'Test Logo',
        type: 'logo',
        mime_type: 'application/json',
        file_size: 2048,
        file_path: '/uploads/artifacts/test-logo.json',
        storage_provider: 'local',
        metadata: {
          format: 'json',
          version: 1,
          canvas: { width: 500, height: 500 },
          elements: [],
        },
        version: 1,
        is_public: false,
      })
      .returning('*');

    console.log(`✅ Created test artifact: ${testArtifact.name}`);

    // Create an admin user
    const [adminUser] = await db('users')
      .insert({
        email: 'admin@aio.com',
        password_hash: hashedPassword,
        first_name: 'Admin',
        last_name: 'User',
        role: 'admin',
        email_verified: true,
        email_verified_at: new Date(),
        is_active: true,
      })
      .returning('*');

    await db('user_preferences').insert({
      user_id: adminUser.id,
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: true,
        admin_dashboard: true,
      },
    });

    console.log(`✅ Created admin user: ${adminUser.email}`);

    // Create Google OAuth test user
    const [googleUser] = await db('users')
      .insert({
        email: 'google@example.com',
        password_hash: null, // OAuth users don't need password
        first_name: 'Google',
        last_name: 'User',
        google_id: 'google_123456789',
        google_access_token: 'sample_access_token',
        google_refresh_token: 'sample_refresh_token',
        google_token_expires_at: new Date(Date.now() + 3600 * 1000),
        avatar_url: 'https://example.com/avatar.jpg',
        role: 'user',
        email_verified: true,
        email_verified_at: new Date(),
        is_active: true,
      })
      .returning('*');

    await db('user_preferences').insert({
      user_id: googleUser.id,
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: false,
      },
    });

    console.log(`✅ Created Google OAuth test user: ${googleUser.email}`);

    // Create additional test projects
    const [graphicsProject] = await db('projects')
      .insert({
        user_id: testUser.id,
        name: 'Brand Identity Project',
        description: 'Complete brand identity design',
        tool_type: 'graphics',
        data: { elements: [], canvas: { width: 1200, height: 800 } },
        status: 'active',
        last_edited_at: new Date(),
      })
      .returning('*');

    const [webProject] = await db('projects')
      .insert({
        user_id: testUser.id,
        name: 'Portfolio Website',
        description: 'Personal portfolio website',
        tool_type: 'web_designer',
        data: { pages: [], components: [] },
        status: 'draft',
        last_edited_at: new Date(),
      })
      .returning('*');

    const [ideProject] = await db('projects')
      .insert({
        user_id: testUser.id,
        name: 'Node.js API',
        description: 'RESTful API for mobile app',
        tool_type: 'ide',
        data: { files: [], dependencies: [] },
        status: 'active',
        last_edited_at: new Date(),
      })
      .returning('*');

    const [cadProject] = await db('projects')
      .insert({
        user_id: testUser.id,
        name: '3D Mechanical Part',
        description: 'Custom gear design',
        tool_type: 'cad',
        data: { models: [], dimensions: {} },
        status: 'draft',
        last_edited_at: new Date(),
      })
      .returning('*');

    const [videoProject] = await db('projects')
      .insert({
        user_id: testUser.id,
        name: 'Product Demo Video',
        description: 'Marketing video for new product',
        tool_type: 'video',
        data: { timeline: [], tracks: [] },
        status: 'active',
        last_edited_at: new Date(),
      })
      .returning('*');

    console.log('✅ Created additional test projects');

    // Create sample audit logs
    await db('audit_logs').insert([
      {
        user_id: testUser.id,
        action: 'user_login',
        resource_type: 'user',
        resource_id: testUser.id,
        old_values: null,
        new_values: { last_login: new Date().toISOString() },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      {
        user_id: testUser.id,
        action: 'project_create',
        resource_type: 'project',
        resource_id: testProject.id,
        old_values: null,
        new_values: { name: testProject.name },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
      {
        user_id: adminUser.id,
        action: 'user_create',
        resource_type: 'user',
        resource_id: googleUser.id,
        old_values: null,
        new_values: { email: googleUser.email, role: 'user' },
        ip_address: '127.0.0.1',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      },
    ]);

    console.log('✅ Created audit logs');

    // Get and display summary
    const userCount = await db('users').count('* as count').first();
    const projectCount = await db('projects').count('* as count').first();
    const sessionCount = await db('sessions').count('* as count').first();
    const messageCount = await db('messages').count('* as count').first();
    const artifactCount = await db('artifacts').count('* as count').first();

    console.log('\n📊 Database Summary:');
    console.log(`   Users: ${userCount?.count || 0}`);
    console.log(`   Projects: ${projectCount?.count || 0}`);
    console.log(`   Sessions: ${sessionCount?.count || 0}`);
    console.log(`   Messages: ${messageCount?.count || 0}`);
    console.log(`   Artifacts: ${artifactCount?.count || 0}`);

    console.log('\n✨ Database seed completed successfully!');
    console.log('\n📝 Test Credentials:');
    console.log('   Email: test@example.com');
    console.log('   Password: password123');
    console.log('\n   Email: admin@aio.com');
    console.log('   Password: password123');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await db.destroy();
  }
}

// Run seed if called directly
if (require.main === module) {
  seed()
    .then(() => {
      console.log('Seed process completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seed process failed:', error);
      process.exit(1);
    });
}

export default seed;
