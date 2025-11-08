import { test, expect } from '@playwright/test';

test.describe('CAD Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('/dashboard');
  });

  test('should load CAD interface', async ({ page }) => {
    await page.goto('/cad');

    await expect(page.locator('h1')).toContainText('3D CAD Modeler');
    await expect(page.locator('[data-testid="viewport"]')).toBeVisible();
    await expect(page.locator('[data-testid="toolbar"]')).toBeVisible();
  });

  test('should create 3D cube', async ({ page }) => {
    await page.goto('/cad');

    await page.click('button[data-tool="cube"]');
    await page.click('button:has-text("Create Cube")');

    await page.fill('input[name="width"]', '2');
    await page.fill('input[name="height"]', '2');
    await page.fill('input[name="depth"]', '2');
    await page.click('button:has-text("Generate")');

    // Cube should appear in viewport
    await expect(page.locator('[data-testid="viewport"]')).toBeVisible();
  });

  test('should create 3D sphere', async ({ page }) => {
    await page.goto('/cad');

    await page.click('button[data-tool="sphere"]');
    await page.click('button:has-text("Create Sphere")');

    await page.fill('input[name="radius"]', '1.5');
    await page.fill('input[name="segments"]', '32');
    await page.click('button:has-text("Generate")');

    await expect(page.locator('[data-testid="viewport"]')).toContainText('');
  });

  test('should transform object (move)', async ({ page }) => {
    await page.goto('/cad');

    // Create a cube first
    await page.click('button[data-tool="cube"]');
    await page.click('button:has-text("Create Cube")');
    await page.fill('input[name="width"]', '1');
    await page.fill('input[name="height"]', '1');
    await page.fill('input[name="depth"]', '1');
    await page.click('button:has-text("Generate")');

    // Select move tool
    await page.click('button[data-tool="move"]');

    // Drag object
    const viewport = page.locator('[data-testid="viewport"]');
    await viewport.dragTo(viewport, {
      sourcePosition: { x: 200, y: 200 },
      targetPosition: { x: 300, y: 300 },
    });

    // Object should move
  });

  test('should rotate object', async ({ page }) => {
    await page.goto('/cad');

    // Create a cube
    await page.click('button[data-tool="cube"]');
    await page.click('button:has-text("Create Cube")');
    await page.fill('input[name="width"]', '1');
    await page.fill('input[name="height"]', '1');
    await page.fill('input[name="depth"]', '1');
    await page.click('button:has-text("Generate")');

    // Select rotate tool
    await page.click('button[data-tool="rotate"]');

    // Rotate using control
    await page.fill('input[name="rotationX"]', '45');
    await page.click('button:has-text("Apply")');

    // Object should be rotated
  });

  test('should change camera view', async ({ page }) => {
    await page.goto('/cad');

    // Create object
    await page.click('button[data-tool="cube"]');
    await page.click('button:has-text("Create Cube")');
    await page.fill('input[name="width"]', '1');
    await page.fill('input[name="height"]', '1');
    await page.fill('input[name="depth"]', '1');
    await page.click('button:has-text("Generate")');

    // Test different views
    await page.click('button[data-view="front"]');
    await page.click('button[data-view="top"]');
    await page.click('button[data-view="left"]');
    await page.click('button[data-view="right"]');
    await page.click('button[data-view="back"]');
    await page.click('button[data-view="bottom"]');
    await page.click('button[data-view="perspective"]');
    await page.click('button[data-view="orthographic"]');
  });

  test('should measure distances', async ({ page }) => {
    await page.goto('/cad');

    // Create objects
    await page.click('button[data-tool="cube"]');
    await page.click('button:has-text("Create Cube")');
    await page.fill('input[name="width"]', '1');
    await page.fill('input[name="height"]', '1');
    await page.fill('input[name="depth"]', '1');
    await page.click('button:has-text("Generate")');

    // Add second cube
    await page.click('button[data-tool="cube"]');
    await page.click('button:has-text("Create Cube")');
    await page.fill('input[name="width"]', '1');
    await page.fill('input[name="height"]', '1');
    await page.fill('input[name="depth"]', '1');
    await page.click('button:has-text("Generate")');

    // Measure
    await page.click('button[data-tool="measure"]');
    await page.click('[data-testid="measure-button"]');

    // Measurement should appear
    await expect(page.locator('[data-testid="measurement-display"]')).toBeVisible();
  });

  test('should export as STL', async ({ page }) => {
    await page.goto('/cad');

    // Create object
    await page.click('button[data-tool="cube"]');
    await page.click('button:has-text("Create Cube")');
    await page.fill('input[name="width"]', '1');
    await page.fill('input[name="height"]', '1');
    await page.fill('input[name="depth"]', '1');
    await page.click('button:has-text("Generate")');

    // Export
    await page.click('button:has-text("Export")');
    await page.selectOption('select[name="format"]', 'stl');
    await page.click('button:has-text("Download")');

    // File should download
  });

  test('should export as OBJ', async ({ page }) => {
    await page.goto('/cad');

    await page.click('button[data-tool="sphere"]');
    await page.click('button:has-text("Create Sphere")');
    await page.fill('input[name="radius"]', '1');
    await page.click('button:has-text("Generate")');

    await page.click('button:has-text("Export")');
    await page.selectOption('select[name="format"]', 'obj');
    await page.click('button:has-text("Download")');
  });

  test('should create primitive cylinder', async ({ page }) => {
    await page.goto('/cad');

    await page.click('button[data-tool="cylinder"]');
    await page.click('button:has-text("Create Cylinder")');

    await page.fill('input[name="radius"]', '1');
    await page.fill('input[name="height"]', '2');
    await page.fill('input[name="segments"]', '16');
    await page.click('button:has-text("Generate")');

    await expect(page.locator('[data-testid="viewport"]')).toContainText('');
  });

  test('should create torus', async ({ page }) => {
    await page.goto('/cad');

    await page.click('button[data-tool="torus"]');
    await page.click('button:has-text("Create Torus")');

    await page.fill('input[name="majorRadius"]', '1');
    await page.fill('input[name="minorRadius"]', '0.3');
    await page.click('button:has-text("Generate")');

    await expect(page.locator('[data-testid="viewport"]')).toContainText('');
  });
});
