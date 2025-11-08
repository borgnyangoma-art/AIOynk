import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Sign in');
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    await page.click('button:has-text("Sign in")');

    const emailError = page.locator('text=Email is required');
    const passwordError = page.locator('text=Password is required');

    await expect(emailError).toBeVisible();
    await expect(passwordError).toBeVisible();
  });

  test('should show error for invalid email', async ({ page }) => {
    await page.fill('input[name="email"]', 'invalid-email');
    await page.click('button:has-text("Sign in")');

    await expect(page.locator('text=Invalid email address')).toBeVisible();
  });

  test('should allow registration with valid data', async ({ page }) => {
    // Use unique email to avoid conflicts
    const timestamp = Date.now();
    await page.fill('input[name="email"]', `test${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');

    await page.click('button:has-text("Create account")');

    // Should redirect to dashboard or show success message
    await expect(page.locator('text=Account created')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // First create an account
    const timestamp = Date.now();
    await page.goto('/register');
    await page.fill('input[name="email"]', `test${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.fill('input[name="confirmPassword"]', 'TestPassword123!');
    await page.click('button:has-text("Create account")');

    // Then login
    await page.goto('/login');
    await page.fill('input[name="email"]', `test${timestamp}@example.com`);
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Sign in")');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'nonexistent@example.com');
    await page.fill('input[name="password"]', 'WrongPassword123!');
    await page.click('button:has-text("Sign in")');

    await expect(page.locator('text=Invalid credentials')).toBeVisible();
  });

  test('should show error for weak password', async ({ page }) => {
    await page.goto('/register');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'weak');
    await page.fill('input[name="confirmPassword"]', 'weak');

    await page.click('button:has-text("Create account")');

    await expect(page.locator('text=Password must be at least 8 characters')).toBeVisible();
  });

  test('should handle OAuth Google login', async ({ page }) => {
    await page.goto('/login');
    await page.click('button:has-text("Sign in with Google")');

    // Should redirect to Google OAuth
    await expect(page).toHaveURL(/accounts\.google\.com/);
  });
});
