import { test, expect } from '@playwright/test';

const key = 'wanhuSimulatorDemoSaveV2';
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', e => { if (e.type() === 'error') errors.push(e.text()); });
  return errors;
}
async function holdIgnition(page) {
  const bounds = await page.locator('#game').boundingBox();
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height * .43);
  await expect(page.locator('#flightState')).toContainText('点火准备');
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height * .43);
  await page.mouse.down();
  // Software WebGL advances fewer frames per second; wait for the actual
  // ignition transition rather than assuming a hardware-GPU frame rate.
  await expect(page.locator('#flightState')).toContainText('飞行中', { timeout: 35_000 });
  await page.mouse.up();
  return bounds;
}
async function seed(page, upgrades, pulse = false) {
  await page.addInitScript(({ key, upgrades, pulse }) => {
    localStorage.setItem(key, JSON.stringify({ coins: 50000, gems: 20, bestHeight: 0, upgrades, pulse }));
  }, { key, upgrades, pulse });
}

test('3D 初始画面、点火、飞行和落地奖励完成整个循环', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'three');
  await expect(page.locator('#coinCount')).toHaveText('420');
  await page.screenshot({ path: info.outputPath('desktop-title.png'), fullPage: true });
  await holdIgnition(page);
  await expect(page.locator('#flightState')).toHaveText('已结算', { timeout: 30_000 });
  const stored = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  expect(stored.coins).toBeGreaterThan(420);
  expect(stored.bestHeight).toBeGreaterThanOrEqual(10);
  await page.screenshot({ path: info.outputPath('landing-result.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('升级、外观材料门槛、钻石突破和刷新存档', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.locator('.gm-panel summary').click();
  await page.locator('#gmAmount').fill('10000');
  await page.locator('#gmAddCoins').click();
  await expect(page.locator('#coinCount')).toHaveText('10,420');
  await page.locator('.upgrade-button[data-upgrade="powder"]').click();
  await expect(page.locator('#powderLevel')).toHaveText('Lv.2 / 999');
  await page.locator('.batch-button[data-upgrade="powder"][data-amount="10"]').click();
  await expect(page.locator('#powderLevel')).toHaveText('Lv.12 / 999');
  await page.locator('#breakthroughButton').click();
  await expect(page.locator('#gemCount')).toHaveText('1');
  await page.locator('.upgrade-button[data-upgrade="appearance"]').click();
  await expect(page.locator('#appearanceEffect')).toContainText('普通飞行器');
  await expect(page.locator('.upgrade-button[data-upgrade="appearance"]')).toBeDisabled();
  await page.reload();
  await expect(page.locator('#powderLevel')).toHaveText('Lv.12 / 999');
  await expect(page.locator('#breakthroughButton')).toHaveText('已装配');
  await expect(page.locator('#appearanceLevel')).toHaveText('Lv.2 / 20');
  expect(errors).toEqual([]);
});

test('太空场景、音速护盾、方向操控和单次脉冲', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.addInitScript(() => {
    window.drawnTexts = [];
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.drawnTexts.push(String(text));
      if (window.drawnTexts.length > 1000) window.drawnTexts.splice(0, 500);
      return fillText.call(this, text, ...args);
    };
  });
  await seed(page, { powder: 299, chair: 30, kites: 299, appearance: 20, income: 10 }, true);
  await page.goto('/');
  const bounds = await holdIgnition(page);
  await expect(page.locator('#currentLocation')).not.toHaveText('万户起飞台');
  await page.keyboard.press('Shift');
  await expect.poll(() => page.evaluate(() => window.drawnTexts.includes('脉冲已使用 · 下局恢复'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.drawnTexts.includes('音速护盾 · 已激活'))).toBe(true);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(400);
  await page.keyboard.up('ArrowRight');
  await page.mouse.move(bounds.x + bounds.width * .4, bounds.y + bounds.height * .6);
  await expect(page.locator('#flightState')).toContainText('无限迁移体');
  await page.screenshot({ path: info.outputPath('deep-space.png'), fullPage: true });
  await expect(page.locator('#bestRun')).not.toHaveText('0 m');
  const glError = await page.locator('#world').evaluate(canvas => canvas.getContext('webgl2').getError());
  expect(glError).toBe(0);
  expect(errors).toEqual([]);
});

test('多联火箭外观在点火和飞行中正确渲染', async ({ page }, info) => {
  const errors = watchErrors(page);
  await seed(page, { powder: 80, chair: 15, kites: 65, appearance: 7, income: 1 });
  await page.goto('/');
  await expect(page.locator('#appearanceEffect')).toContainText('大火箭');
  await holdIgnition(page);
  await expect(page.locator('#flightState')).toContainText('大火箭 · 飞行中');
  await page.screenshot({ path: info.outputPath('rocket-flight.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('手机触屏点火、响应式布局及失去触点后停止蓄力', async ({ page }, info) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const canvas = page.locator('#game');
  await canvas.scrollIntoViewIfNeeded();
  const bounds = await canvas.boundingBox();
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const touchPoints = [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height * .43 }];
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(page.locator('#flightState')).toContainText('点火准备');
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints });
  await page.waitForTimeout(200);
  await session.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  await page.waitForTimeout(1500);
  await expect(page.locator('#flightState')).toContainText('点火准备');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('mobile.png'), fullPage: true });
  expect(errors).toEqual([]);
});

test('显式 2D 兼容模式仍可完成飞行与存档', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/?renderer=2d');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'canvas');
  await expect(page.locator('#world')).toBeHidden();
  await holdIgnition(page);
  await expect(page.locator('#flightState')).toHaveText('已结算', { timeout: 30_000 });
  const saved = await page.evaluate(key => JSON.parse(localStorage.getItem(key)), key);
  expect(saved.bestHeight).toBeGreaterThanOrEqual(10);
  expect(errors).toEqual([]);
});

test('WebGL 上下文丢失后切换到 2D 并继续运行', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'three');
  const supported = await page.locator('#world').evaluate(canvas => {
    const extension = canvas.getContext('webgl2').getExtension('WEBGL_lose_context');
    if (!extension) return false;
    extension.loseContext(); return true;
  });
  expect(supported).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-renderer', 'canvas');
  await expect(page.locator('#world')).toBeHidden();
  await holdIgnition(page);
  await expect(page.locator('#flightState')).toHaveText('已结算', { timeout: 30_000 });
  expect(errors).toEqual([]);
});
