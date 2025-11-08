import { test, expect } from '@playwright/test';

test.describe('Video Editor Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'TestPassword123!');
    await page.click('button:has-text("Sign in")');
    await page.waitForURL('/dashboard');
  });

  test('should load video editor interface', async ({ page }) => {
    await page.goto('/video');

    await expect(page.locator('h1')).toContainText('Video Editor');
    await expect(page.locator('[data-testid="timeline"]')).toBeVisible();
    await expect(page.locator('[data-testid="preview"]')).toBeVisible();
    await expect(page.locator('[data-testid="toolbar"]')).toBeVisible();
  });

  test('should upload video file', async ({ page }) => {
    await page.goto('/video');

    await page.click('button:has-text("Upload Video")');

    // Upload a test video file
    await page.setInputFiles('input[type="file"]', {
      name: 'test-video.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-data'),
    });

    // Video should appear in timeline
    await expect(page.locator('[data-testid="timeline"]')).toContainText('test-video.mp4');
  });

  test('should create new project', async ({ page }) => {
    await page.goto('/video');

    await page.click('button:has-text("New Project")');
    await page.fill('input[name="projectName"]', 'My Video Project');
    await page.selectOption('select[name="resolution"]', '1920x1080');
    await page.selectOption('select[name="fps"]', '30');
    await page.click('button:has-text("Create")');

    await expect(page.locator('text=My Video Project')).toBeVisible();
  });

  test('should add clip to timeline', async ({ page }) => {
    await page.goto('/video');

    // Create project
    await page.click('button:has-text("New Project")');
    await page.fill('input[name="projectName"]', 'Timeline Test');
    await page.click('button:has-text("Create")');

    // Upload video
    await page.click('button:has-text("Upload Video")');
    await page.setInputFiles('input[type="file"]', {
      name: 'clip1.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-data'),
    });

    // Drag clip to timeline
    const clip = page.locator('[data-testid="clip"]:has-text("clip1.mp4")');
    const timeline = page.locator('[data-testid="timeline-track"]');

    await clip.dragTo(timeline);

    // Clip should be in timeline
    await expect(timeline).toContainText('clip1.mp4');
  });

  test('should trim clip', async ({ page }) => {
    await page.goto('/video');

    await page.click('button:has-text("New Project")');
    await page.fill('input[name="projectName"]', 'Trim Test');
    await page.click('button:has-text("Create")');

    // Add clip
    await page.setInputFiles('input[type="file"]', {
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-data'),
    });

    // Drag to timeline
    const clip = page.locator('[data-testid="clip"]:has-text("test.mp4")');
    await clip.dragTo(page.locator('[data-testid="timeline-track"]'));

    // Select clip
    await clip.click();

    // Trim clip
    await page.dragTo(
      page.locator('[data-testid="clip-end-handle"]'),
      page.locator('[data-testid="timeline-track"]'),
      {
        sourcePosition: { x: 200, y: 10 },
        targetPosition: { x: 100, y: 10 },
      }
    );

    // Clip should be trimmed
  });

  test('should add text overlay', async ({ page }) => {
    await page.goto('/video');

    await page.click('button:has-text("New Project")');
    await page.fill('input[name="projectName"]', 'Text Test');
    await page.click('button:has-text("Create")');

    await page.setInputFiles('input[type="file"]', {
      name: 'base.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-data'),
    });

    const clip = page.locator('[data-testid="clip"]:has-text("base.mp4")');
    await clip.dragTo(page.locator('[data-testid="timeline-track"]'));

    // Add text
    await page.click('button[data-effect="text"]');
    await page.fill('input[name="text"]', 'Sample Title');
    await page.selectOption('select[name="textType"]', 'title');
    await page.fill('input[name="positionX"]', '100');
    await page.fill('input[name="positionY"]', '100');
    await page.click('button:has-text("Add Text")');

    // Text should be added
    await expect(page.locator('[data-testid="effect-layer"]')).toContainText('Sample Title');
  });

  test('should apply filter effect', async ({ page }) => {
    await page.goto('/video');

    await page.click('button:has-text("New Project")');
    await page.fill('input[name="projectName"]', 'Filter Test');
    await page.click('button:has-text("Create")');

    await page.setInputFiles('input[type="file"]', {
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-data'),
    });

    const clip = page.locator('[data-testid="clip"]:has-text("test.mp4")');
    await clip.dragTo(page.locator('[data-testid="timeline-track"]'));

    // Add blur filter
    await page.click('button[data-effect="filter"]');
    await page.selectOption('select[name="filterType"]', 'blur');
    await page.fill('input[name="intensity"]', '5');
    await page.click('button:has-text("Apply")');

    // Filter should be applied
    await expect(page.locator('[data-testid="effects-panel"]')).toContainText('blur');
  });

  test('should add transition between clips', async ({ page }) => {
    await page.goto('/video');

    await page.click('button:has-text("New Project")');
    await page.fill('input[name="projectName"]', 'Transition Test');
    await page.click('button:has-text("Create")');

    // Add two clips
    await page.setInputFiles('input[type="file"]', {
      name: 'clip1.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-data'),
    });

    await page.setInputFiles('input[type="file"]', {
      name: 'clip2.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-data'),
    });

    // Add both to timeline
    const clip1 = page.locator('[data-testid="clip"]:has-text("clip1.mp4")');
    const clip2 = page.locator('[data-testid="clip"]:has-text("clip2.mp4")');
    const track = page.locator('[data-testid="timeline-track"]');

    await clip1.dragTo(track);
    await clip2.dragTo(track);

    // Add transition
    await page.click('button[data-effect="transition"]');
    await page.selectOption('select[name="transitionType"]', 'fade');
    await page.fill('input[name="duration"]', '1');
    await page.click('button:has-text("Add Transition")');

    await expect(page.locator('[data-testid="transition"]')).toContainText('fade');
  });

  test('should preview video', async ({ page }) => {
    await page.goto('/video');

    await page.click('button:has-text("New Project")');
    await page.fill('input[name="projectName"]', 'Preview Test');
    await page.click('button:has-text("Create")');

    await page.setInputFiles('input[type="file"]', {
      name: 'test.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-data'),
    });

    const clip = page.locator('[data-testid="clip"]:has-text("test.mp4")');
    await clip.dragTo(page.locator('[data-testid="timeline-track"]'));

    // Click play
    await page.click('button[data-action="play"]');

    // Play button should change to pause
    await expect(page.locator('button[data-action="pause"]')).toBeVisible();
  });

  test('should render video', async ({ page }) => {
    await page.goto('/video');

    await page.click('button:has-text("New Project")');
    await page.fill('input[name="projectName"]', 'Render Test');
    await page.click('button:has-text("Create")');

    await page.setInputFiles('input[type="file"]', {
      name: 'source.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fake-video-data'),
    });

    const clip = page.locator('[data-testid="clip"]:has-text("source.mp4")');
    await clip.dragTo(page.locator('[data-testid="timeline-track"]'));

    // Start render
    await page.click('button:has-text("Render")');
    await page.selectOption('select[name="outputFormat"]', 'mp4');
    await page.click('button:has-text("Start Render")');

    // Progress should appear
    await expect(page.locator('[data-testid="render-progress"]')).toBeVisible();
  });

  test('should show supported formats', async ({ page }) => {
    await page.goto('/video');

    await page.click('button:has-text("Formats")');

    const formats = ['MP4', 'AVI', 'MOV', 'WebM'];

    for (const format of formats) {
      await expect(page.locator(`text=${format}`)).toBeVisible();
    }
  });

  test('should show effect library', async ({ page }) => {
    await page.goto('/video');

    await page.click('button:has-text("Effects")');

    // Check for filters
    await expect(page.locator('text=Blur')).toBeVisible();
    await expect(page.locator('text=Brightness')).toBeVisible();
    await expect(page.locator('text=Contrast')).toBeVisible();

    // Check for transitions
    await expect(page.locator('text=Fade')).toBeVisible();
    await expect(page.locator('text=Slide')).toBeVisible();
    await expect(page.locator('text=Dissolve')).toBeVisible();
  });
});
