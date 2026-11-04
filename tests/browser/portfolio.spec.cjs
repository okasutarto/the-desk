const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../../dist/.vite/manifest.json'), 'utf8'));
const classicFiles = Object.values(manifest).filter(chunk => chunk.src?.includes('portfolio2d') || chunk.name === 'usePostHog').map(chunk => '/' + chunk.file);

// Keep smoke tests local: no analytics, mail, paid chat calls or live weather dependencies.
test.beforeEach(async ({ page }) => {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.hostname === '127.0.0.1') return route.continue();
    return route.abort();
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('desk-settings')) {
      localStorage.setItem('desk-settings', JSON.stringify({ time: 'day', rain: 'clear' }));
    }
  });
});

test.afterEach(async ({ page }, testInfo) => {
  if (!page.isClosed()) await testInfo.attach('last-frame', { body: await page.screenshot(), contentType: 'image/png' });
});

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /THREE\.WebGLProgram|Error creating WebGL context/.test(message.text())) errors.push(message.text());
  });
  return errors;
}

async function enterDesk(page) {
  await expect(page.locator('#boot-loader')).toHaveAttribute('aria-label', 'The desk is ready', { timeout: 90000 });
  // The named button is intentionally screen-reader-only; sighted visitors tap the overlay.
  await page.locator('#boot-loader').click({ position: { x: 16, y: 16 } });
  await expect(page.locator('#boot-loader')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Room settings', exact: true })).toBeVisible();
  await expect(page.locator('.desk-page canvas')).toBeVisible();
  await expect(page.getByText("WebGL isn't available here.", { exact: false })).toHaveCount(0);
}

async function openSettings(page) {
  await page.getByRole('button', { name: 'Room settings', exact: true }).click();
  await expect(page.locator('#room-settings')).toBeVisible();
}

test('desk keeps 2D bundles lazy and persists settings across reload and route teardown', async ({ page, isMobile }) => {
  const errors = watchErrors(page);
  const loaded = [];
  page.on('request', request => loaded.push(new URL(request.url()).pathname));
  await page.goto('/?quality=low');
  await enterDesk(page);
  expect(loaded.filter(file => classicFiles.includes(file))).toEqual([]);
  await openSettings(page);
  await page.getByRole('button', { name: 'Night', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Night', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('desk-settings')).time)).toBe('night');
  await page.getByRole('button', { name: /Desk devices/ }).click();
  for (const name of ['Phone: Glacier', 'Keyboard: Sakura Fizz', 'Mouse: Magenta']) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('desk-settings')).deviceFinishes)).toEqual({ phone: 'glacier', keyboard: 'sakura', mouse: 'magenta' });
  await page.reload();
  await enterDesk(page);
  await openSettings(page);
  await expect(page.getByRole('button', { name: 'Night', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Desk devices/ }).click();
  for (const name of ['Phone: Glacier', 'Keyboard: Sakura Fizz', 'Mouse: Magenta']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }

  await page.getByRole('button', { name: 'Close room settings', exact: true }).click();
  await page.getByRole('link', { name: '← 2D site', exact: true }).click();
  await expect(page).toHaveURL('/2d');
  await expect(page.getByRole('heading', { name: 'Oka Sutarto Putra, Full Stack Developer & Mobile Engineer', exact: true })).toBeVisible();
  await expect(page.locator('.desk-page')).toHaveCount(0);
  expect(loaded.some(file => file.includes('PortfolioLayout-'))).toBe(true);
  await expect(page.getByRole('button', { name: 'Open chat', exact: true })).toBeVisible();
  if (isMobile) await page.getByRole('button', { name: 'Toggle navigation menu', exact: true }).click();
  await page.getByRole('link', { name: '3D Desk', exact: false }).filter({ visible: true }).click();
  await expect(page).toHaveURL('/');
  // The boot loader is only present on a full load; route entry starts the scene directly.
  await expect(page.getByRole('button', { name: 'Room settings', exact: true })).toBeVisible({ timeout: 90000 });
  await openSettings(page);
  await expect(page.getByRole('button', { name: 'Night', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: /Desk devices/ }).click();
  for (const name of ['Phone: Glacier', 'Keyboard: Sakura Fizz', 'Mouse: Magenta']) {
    await expect(page.getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
  }

  expect(errors).toEqual([]);
});

test('classic deep links and 404 use the lazy shell with local title directives', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/2d#projects');
  await expect(page.getByRole('heading', { name: /^my projects$/i })).toBeVisible();
  await expect(page.locator('#boot-loader')).toHaveCount(0);
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.locator('.title-reveal-word').first()).toBeAttached();
  await page.goto('/missing-page');
  await expect(page.getByRole('heading', { name: 'Page Not Found', exact: true })).toBeVisible();
  await expect(page.locator('nav')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open chat', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('monitor keyboard focus and terminal command survive the split', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Monitor keyboard shortcuts are a desktop interaction.');
  const errors = watchErrors(page);
  await page.goto('/?quality=low');
  await enterDesk(page);
  await page.keyboard.press('t');
  await expect(page.getByRole('button', { name: /^> help$/i })).toBeVisible();
  await page.getByRole('button', { name: /^> whoami$/i }).click();
  await page.getByRole('button', { name: /back to desk/i }).click();
  await expect(page.getByRole('button', { name: /^> help$/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('404 text and actions retain readable contrast in light and dark themes', async ({ page }, testInfo) => {
  const errors = watchErrors(page);
  await page.goto('/missing-page');
  const errorPage = page.locator('.not-found');
  await expect(page.getByRole('heading', { name: '404', exact: true })).toBeVisible();
  for (const mode of ['light', 'dark']) {
    if (mode === 'dark') await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
    await expect(page.locator('body')).toHaveCSS('background-color', mode === 'dark' ? 'rgb(26, 23, 20)' : 'rgb(240, 240, 240)');
    const ratios = await errorPage.evaluate(el => {
      const luminance = color => {
        const channels = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const background = luminance(getComputedStyle(document.body).backgroundColor);
      const text = selector => luminance(getComputedStyle(el.querySelector(selector)).color);
      return {
        code: ratio(text('h1'), background),
        description: ratio(text('p'), background),
        home: ratio(text('a'), luminance(getComputedStyle(el.querySelector('a')).backgroundColor)),
        back: ratio(text('button'), background),
      };
    });
    expect(ratios.code).toBeGreaterThanOrEqual(3);
    for (const item of ['description', 'home', 'back']) expect(ratios[item], `${mode} ${item}`).toBeGreaterThanOrEqual(4.5);
    const screenshot = testInfo.outputPath(`404-${mode}.png`);
    await errorPage.screenshot({ path: screenshot });
    await testInfo.attach(`404-${mode}`, { path: screenshot, contentType: 'image/png' });
  }
  expect(errors).toEqual([]);
});
