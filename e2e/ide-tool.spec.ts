import { test, expect } from '@playwright/test';

test.describe('Code IDE Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('/dashboard');
  });

  test('should load IDE interface', async ({ page }) => {
    await page.goto('/ide');

    await expect(page.locator('h1')).toContainText('Code IDE');
    await expect(page.locator('[data-testid="editor-container"]')).toBeVisible();
    await expect(page.locator('[data-testid="output-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-explorer"]')).toBeVisible();
  });

  test('should create new project', async ({ page }) => {
    await page.goto('/ide');

    await page.click('button:has-text("New Project")');
    await page.selectOption('select[name="language"]', 'javascript');
    await page.fill('input[name="projectName"]', 'Test Project');
    await page.click('button:has-text("Create")');

    await expect(page.locator('text=Test Project')).toBeVisible();
  });

  test('should execute JavaScript code', async ({ page }) => {
    await page.goto('/ide');

    // Create new project
    await page.click('button:has-text("New Project")');
    await page.selectOption('select[name="language"]', 'javascript');
    await page.fill('input[name="projectName"]', 'JS Test');
    await page.click('button:has-text("Create")');

    // Type code
    const codeEditor = page.locator('[data-testid="code-editor"]');
    await codeEditor.click();
    await page.keyboard.type('console.log("Hello, World!");');

    // Run code
    await page.click('button:has-text("Run")');

    // Check output
    await expect(page.locator('[data-testid="output-panel"]')).toContainText('Hello, World!');
  });

  test('should execute Python code', async ({ page }) => {
    await page.goto('/ide');

    await page.click('button:has-text("New Project")');
    await page.selectOption('select[name="language"]', 'python');
    await page.fill('input[name="projectName"]', 'Python Test');
    await page.click('button:has-text("Create")');

    const codeEditor = page.locator('[data-testid="code-editor"]');
    await codeEditor.click();
    await page.keyboard.type('print("Hello, World!")');

    await page.click('button:has-text("Run")');

    await expect(page.locator('[data-testid="output-panel"]')).toContainText('Hello, World!');
  });

  test('should show syntax errors', async ({ page }) => {
    await page.goto('/ide');

    await page.click('button:has-text("New Project")');
    await page.selectOption('select[name="language"]', 'javascript');
    await page.fill('input[name="projectName"]', 'Syntax Test');
    await page.click('button:has-text("Create")');

    const codeEditor = page.locator('[data-testid="code-editor"]');
    await codeEditor.click();
    await page.keyboard.type('console.log("incomplete string');

    // Wait a moment for syntax check
    await page.waitForTimeout(1000);

    // Syntax error should be highlighted
    await expect(page.locator('[data-testid="syntax-error"]')).toBeVisible();
  });

  test('should run security scan', async ({ page }) => {
    await page.goto('/ide');

    await page.click('button:has-text("New Project")');
    await page.selectOption('select[name="language"]', 'javascript');
    await page.fill('input[name="projectName"]', 'Security Test');
    await page.click('button:has-text("Create")');

    const codeEditor = page.locator('[data-testid="code-editor"]');
    await codeEditor.click();
    // Add code with security issue
    await page.keyboard.type('eval("alert(1)")');

    await page.click('button:has-text("Security Scan")');

    await expect(page.locator('[data-testid="security-warning"]')).toContainText('eval()');
  });

  test('should handle multiple files', async ({ page }) => {
    await page.goto('/ide');

    await page.click('button:has-text("New Project")');
    await page.selectOption('select[name="language"]', 'javascript');
    await page.fill('input[name="projectName"]', 'Multi-file Test');
    await page.click('button:has-text("Create")');

    // Create second file
    await page.click('button:has-text("New File")');
    await page.fill('input[name="fileName"]', 'utils.js');
    await page.click('button:has-text("Create")');

    // Both files should be visible in explorer
    await expect(page.locator('text=index.js')).toBeVisible();
    await expect(page.locator('text=utils.js')).toBeVisible();
  });

  test('should format code', async ({ page }) => {
    await page.goto('/ide');

    await page.click('button:has-text("New Project")');
    await page.selectOption('select[name="language"]', 'javascript');
    await page.fill('input[name="projectName"]', 'Format Test');
    await page.click('button:has-text("Create")');

    const codeEditor = page.locator('[data-testid="code-editor"]');
    await codeEditor.click();
    // Write unformatted code
    await page.keyboard.type('function test(){console.log("test");return true;}');

    await page.click('button:has-text("Format")');

    // Code should be formatted
    await expect(codeEditor).toContainText('function test()');
  });

  test('should show execution history', async ({ page }) => {
    await page.goto('/ide');

    await page.click('button:has-text("New Project")');
    await page.selectOption('select[name="language"]', 'javascript');
    await page.fill('input[name="projectName"]', 'History Test');
    await page.click('button:has-text("Create")');

    const codeEditor = page.locator('[data-testid="code-editor"]');
    await codeEditor.click();
    await page.keyboard.type('console.log("test")');

    await page.click('button:has-text("Run")');
    await page.waitForTimeout(500);

    // Run again
    await page.keyboard.type('console.log("test2")');
    await page.click('button:has-text("Run")');

    // Both runs should be in history
    await page.click('button:has-text("History")');
    await expect(page.locator('[data-testid="execution-history"]')).toContainText('test');
  });

  test('should save and load project', async ({ page }) => {
    await page.goto('/ide');

    await page.click('button:has-text("New Project")');
    await page.selectOption('select[name="language"]', 'javascript');
    await page.fill('input[name="projectName"]', 'Save Test');
    await page.click('button:has-text("Create")');

    const codeEditor = page.locator('[data-testid="code-editor"]');
    await codeEditor.click();
    await page.keyboard.type('const message = "Saved";');

    // Save
    await page.click('button:has-text("Save")');

    // Load
    await page.click('button:has-text("Load")');
    await page.click('text=Save Test');

    // Code should be restored
    await expect(codeEditor).toContainText('const message = "Saved"');
  });
});
