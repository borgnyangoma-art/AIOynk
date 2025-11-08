import { test, expect } from '@playwright/test';

test.describe('Chat Interface', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('/dashboard');
  });

  test('should display chat interface', async ({ page }) => {
    await page.goto('/chat');

    await expect(page.locator('[data-testid="chat-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
  });

  test('should send a message', async ({ page }) => {
    await page.goto('/chat');

    const message = 'Hello, can you help me create a logo?';
    await page.fill('[data-testid="message-input"]', message);
    await page.click('[data-testid="send-button"]');

    // Check if message appears in chat
    await expect(page.locator('text=Hello, can you help me create a logo?')).toBeVisible();
  });

  test('should show typing indicator when sending message', async ({ page }) => {
    await page.goto('/chat');

    await page.fill('[data-testid="message-input"]', 'Test message');
    await page.click('[data-testid="send-button"]');

    // Typing indicator should appear briefly
    await expect(page.locator('[data-testid="typing-indicator"]')).toBeVisible();
  });

  test('should maintain conversation history', async ({ page }) => {
    await page.goto('/chat');

    // Send multiple messages
    const messages = [
      'First message',
      'Second message',
      'Third message',
    ];

    for (const msg of messages) {
      await page.fill('[data-testid="message-input"]', msg);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(500);
    }

    // All messages should be visible
    for (const msg of messages) {
      await expect(page.locator(`text=${msg}`)).toBeVisible();
    }
  });

  test('should handle message with attachments', async ({ page }) => {
    await page.goto('/chat');

    // Upload a file
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-image-data'),
    });

    await page.fill('[data-testid="message-input"]', 'Check out this image');
    await page.click('[data-testid="send-button"]');

    await expect(page.locator('text=Check out this image')).toBeVisible();
    await expect(page.locator('[data-testid="attachment-preview"]')).toBeVisible();
  });

  test('should switch to graphics tool from chat', async ({ page }) => {
    await page.goto('/chat');

    // Send message requesting graphics editor
    await page.fill('[data-testid="message-input"]', 'Open the graphics editor');
    await page.click('[data-testid="send-button"]');

    // Should switch to graphics tool
    await expect(page.locator('[data-testid="tool-container"]')).toContainText('Graphics Editor');
  });

  test('should preserve chat context when switching tools', async ({ page }) => {
    await page.goto('/chat');

    // Send message
    await page.fill('[data-testid="message-input"]', 'Create a blue circle');
    await page.click('[data-testid="send-button"]');

    // Switch to graphics
    await page.click('button:has-text("Graphics Editor")');

    // Go back to chat
    await page.click('button:has-text("Chat")');

    // Previous message should still be visible
    await expect(page.locator('text=Create a blue circle')).toBeVisible();
  });

  test('should show markdown rendering in messages', async ({ page }) => {
    await page.goto('/chat');

    const markdownMessage = '**Bold text** and *italic text*';
    await page.fill('[data-testid="message-input"]', markdownMessage);
    await page.click('[data-testid="send-button"]');

    // Check if markdown is rendered
    const message = page.locator('text=Bold text').first();
    await expect(message).toHaveCSS('font-weight', '700');
  });
});
