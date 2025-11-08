import { test, expect } from '@playwright/test';

test.describe('Web Designer Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('/dashboard');
  });

  test('should load web designer interface', async ({ page }) => {
    await page.goto('/web-designer');

    await expect(page.locator('h1')).toContainText('Web Designer');
    await expect(page.locator('[data-testid="designer-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview-panel"]')).toBeVisible();
  });

  test('should generate web page from description', async ({ page }) => {
    await page.goto('/web-designer');

    const description = 'Create a landing page for a SaaS product with a hero section, features, and pricing';
    await page.fill('[data-testid="description-input"]', description);
    await page.selectOption('select[name="framework"]', 'react');
    await page.click('button:has-text("Generate")');

    // Wait for generation
    await page.waitForSelector('[data-testid="generation-progress"]', { state: 'visible' });
    await expect(page.locator('text=Generating...')).toBeVisible();

    // Check if code is generated
    await expect(page.locator('[data-testid="code-editor"]')).toBeVisible();
  });

  test('should show responsive preview (desktop)', async ({ page }) => {
    await page.goto('/web-designer');

    await page.click('button[data-viewport="desktop"]');

    const preview = page.locator('[data-testid="preview-panel"]');
    await expect(preview).toHaveCSS('width', '100%');
  });

  test('should show responsive preview (tablet)', async ({ page }) => {
    await page.goto('/web-designer');

    await page.click('button[data-viewport="tablet"]');

    const preview = page.locator('[data-testid="preview-panel"]');
    await expect(preview).toHaveCSS('width', '768px');
  });

  test('should show responsive preview (mobile)', async ({ page }) => {
    await page.goto('/web-designer');

    await page.click('button[data-viewport="mobile"]');

    const preview = page.locator('[data-testid="preview-panel"]');
    await expect(preview).toHaveCSS('width', '375px');
  });

  test('should check WCAG compliance', async ({ page }) => {
    await page.goto('/web-designer');

    // Generate a simple page first
    await page.fill('[data-testid="description-input"]', 'Create a simple page');
    await page.click('button:has-text("Generate")');
    await page.waitForTimeout(2000);

    // Check compliance
    await page.click('button:has-text("Check Accessibility")');

    await expect(page.locator('[data-testid="compliance-report"]')).toBeVisible();
  });

  test('should display component library', async ({ page }) => {
    await page.goto('/web-designer');

    await page.click('button:has-text("Components")');

    const components = [
      'Button',
      'Card',
      'Form',
      'Navbar',
      'Footer',
    ];

    for (const component of components) {
      await expect(page.locator(`text=${component}`)).toBeVisible();
    }
  });

  test('should edit code directly', async ({ page }) => {
    await page.goto('/web-designer');

    // Generate initial code
    await page.fill('[data-testid="description-input"]', 'Create a simple page');
    await page.click('button:has-text("Generate")');
    await page.waitForTimeout(2000);

    // Switch to code editor
    await page.click('button[data-tab="code"]');

    // Edit code
    const codeEditor = page.locator('[data-testid="code-editor"]');
    await codeEditor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('<h1>Hello World</h1>');

    // Preview should update
    const preview = page.locator('[data-testid="preview-panel"]');
    await expect(preview).toContainText('Hello World');
  });

  test('should export as React components', async ({ page }) => {
    await page.goto('/web-designer');

    await page.fill('[data-testid="description-input"]', 'Create a button');
    await page.selectOption('select[name="framework"]', 'react');
    await page.click('button:has-text("Generate")');
    await page.waitForTimeout(2000);

    await page.click('button:has-text("Export")');
    await page.click('button:has-text("Download ZIP")');

    // File should download
  });

  test('should import existing design', async ({ page }) => {
    await page.goto('/web-designer');

    await page.click('button:has-text("Import")');
    await page.setInputFiles('input[type="file"]', {
      name: 'design.html',
      mimeType: 'text/html',
      buffer: Buffer.from('<h1>Test</h1>'),
    });

    // Design should be imported
    await expect(page.locator('[data-testid="preview-panel"]')).toContainText('Test');
  });

  test('should switch between HTML, CSS, and JS tabs', async ({ page }) => {
    await page.goto('/web-designer');

    await page.fill('[data-testid="description-input"]', 'Create a page');
    await page.click('button:has-text("Generate")');
    await page.waitForTimeout(2000);

    // Switch to CSS tab
    await page.click('button[data-tab="css"]');
    await expect(page.locator('[data-testid="css-editor"]')).toBeVisible();

    // Switch to JS tab
    await page.click('button[data-tab="js"]');
    await expect(page.locator('[data-testid="js-editor"]')).toBeVisible();
  });
});
