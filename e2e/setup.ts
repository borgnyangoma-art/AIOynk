import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');

  // Start services if not already running
  const { exec } = require('child_process');

  // Check if backend is running
  try {
    const response = await fetch('http://localhost:3000/health');
    if (!response.ok) {
      throw new Error('Backend not healthy');
    }
    console.log('✅ Backend is running');
  } catch (error) {
    console.log('⚠️  Backend not running. Please start services before running E2E tests.');
    console.log('   Run: npm run dev:backend & npm run dev:frontend');
  }

  // Check if frontend is running
  try {
    const response = await fetch('http://localhost:5173');
    if (!response.ok) {
      throw new Error('Frontend not running');
    }
    console.log('✅ Frontend is running');
  } catch (error) {
    console.log('⚠️  Frontend not running. Please start services before running E2E tests.');
  }

  console.log('✅ E2E test setup complete');
}

export default globalSetup;
