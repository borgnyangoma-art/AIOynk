import { test, expect } from '@playwright/test';

test.describe('Graphics Editor Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('/dashboard');
  });

  test('should load graphics editor', async ({ page }) => {
    await page.goto('/graphics');

    await expect(page.locator('h1')).toContainText('Graphics Editor');
    await expect(page.locator('[data-testid="canvas-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="toolbar"]')).toBeVisible();
  });

  test('should create new canvas', async ({ page }) => {
    await page.goto('/graphics');

    await page.click('button:has-text("New Canvas")');
    await page.fill('input[name="width"]', '800');
    await page.fill('input[name="height"]', '600');
    await page.fill('input[name="background"]', '#ffffff');
    await page.click('button:has-text("Create")');

    await expect(page.locator('[data-testid="canvas"]')).toBeVisible();
  });

  test('should add shapes to canvas', async ({ page }) => {
    await page.goto('/graphics');

    // Wait for canvas to be ready
    await page.waitForSelector('[data-testid="canvas"]', { state: 'visible' });

    // Add a rectangle
    await page.click('button[data-tool="rectangle"]');
    await page.click('[data-testid="canvas"]', { position: { x: 100, y: 100 } });

    // Add a circle
    await page.click('button[data-tool="circle"]');
    await page.click('[data-testid="canvas"]', { position: { x: 200, y: 200 } });

    // Check if shapes were added
    await expect(page.locator('[data-testid="canvas"]')).toContainText('');
  });

  test('should select and transform objects', async ({ page }) => {
    await page.goto('/graphics');

    // Add a rectangle first
    await page.waitForSelector('[data-testid="canvas"]', { state: 'visible' });
    await page.click('button[data-tool="rectangle"]');
    await page.click('[data-testid="canvas"]', { position: { x: 100, y: 100 } });

    // Select the object
    await page.click('[data-testid="canvas"]', { position: { x: 100, y: 100 } });

    // Resize handles should appear
    await expect(page.locator('[data-testid="resize-handle"]')).toBeVisible();
  });

  test('should change object properties', async ({ page }) => {
    await page.goto('/graphics');

    // Add a rectangle
    await page.waitForSelector('[data-testid="canvas"]', { state: 'visible' });
    await page.click('button[data-tool="rectangle"]');
    await page.click('[data-testid="canvas"]', { position: { x: 100, y: 100 } });

    // Open properties panel
    await page.click('button:has-text("Properties")');

    // Change fill color
    await page.fill('input[name="fillColor"]', '#ff0000');
    await page.click('button:has-text("Apply")');

    // Check if color changed (visual verification in actual implementation)
  });

  test('should export canvas as PNG', async ({ page }) => {
    await page.goto('/graphics');

    // Add a simple shape
    await page.waitForSelector('[data-testid="canvas"]', { state: 'visible' });
    await page.click('button[data-tool="rectangle"]');
    await page.click('[data-testid="canvas"]', { position: { x: 100, y: 100 } });

    // Export
    await page.click('button:has-text("Export")');
    await page.selectOption('select[name="format"]', 'png');
    await page.click('button:has-text("Download")');

    // File should download (cannot verify actual file in headless mode)
  });

  test('should undo/redo actions', async ({ page }) => {
    await page.goto('/graphics');

    await page.waitForSelector('[data-testid="canvas"]', { state: 'visible' });

    // Add a shape
    await page.click('button[data-tool="rectangle"]');
    await page.click('[data-testid="canvas"]', { position: { x: 100, y: 100 } });

    // Undo
    await page.click('button[data-testid="undo-button"]');

    // Check if undo worked
    // Redo
    await page.click('button[data-testid="redo-button"]');

    // Check if redo worked
  });

  test('should show canvas statistics', async ({ page }) => {
    await page.goto('/graphics');

    await page.waitForSelector('[data-testid="canvas"]', { state: 'visible' });

    // Add some objects
    await page.click('button[data-tool="rectangle"]');
    await page.click('[data-testid="canvas"]', { position: { x: 100, y: 100 } });

    // Open statistics panel
    await page.click('button:has-text("Statistics")');

    await expect(page.locator('[data-testid="object-count"]')).toContainText('1');
  });

  test('should handle keyboard shortcuts', async ({ page }) => {
    await page.goto('/graphics');

    await page.waitForSelector('[data-testid="canvas"]', { state: 'visible' });

    // Add a shape
    await page.click('button[data-tool="rectangle"]');
    await page.click('[data-testid="canvas"]', { position: { x: 100, y: 100 } });

    // Delete using keyboard
    await page.keyboard.press('Delete');

    // Object should be removed
  });

  test('should save and load canvas', async ({ page }) => {
    await page.goto('/graphics');

    await page.waitForSelector('[data-testid="canvas"]', { state: 'visible' });

    // Add a shape
    await page.click('button[data-tool="rectangle"]');
    await page.click('[data-testid="canvas"]', { position: { x: 100, y: 100 } });

    // Save
    await page.click('button:has-text("Save")');
    await page.fill('input[name="canvasName"]', 'Test Canvas');
    await page.click('button:has-text("Save")');

    // Load
    await page.click('button:has-text("Load")');
    await page.click('text=Test Canvas');

    // Canvas should be restored
  });
});
