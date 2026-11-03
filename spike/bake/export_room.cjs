// Bake spike: export the live room's static meshes and key lights for bake_existing.py.
//   node spike/bake/export_room.cjs [http://localhost:8100] [day]
// Needs the dev server running (npm run dev -- --port 8100). Writes spike/bake/existing-out/.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const base = process.argv[2] || "http://localhost:8100";
const time = process.argv[3] || "day";
const out = path.join(__dirname, "existing-out");

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chromium", args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=metal"] });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })).newPage();
  await page.goto(`${base}/?bake=export&time=${time}&perf&bench=no-batch`);
  await page.waitForFunction(() => /PRESS ENTER/i.test(document.body.innerText) && window.__bake?.ready, null, { timeout: 120000 });
  await page.keyboard.press("Enter");
  await page.waitForTimeout(5000);
  const { header, positions } = await page.evaluate(() => window.__bake.export());
  fs.writeFileSync(path.join(out, "room.json"), JSON.stringify(header));
  fs.writeFileSync(path.join(out, "room.bin"), Buffer.from(positions, "base64"));
  const triangles = header.meshes.reduce((n, m) => n + m.count / 3, 0);
  const receivers = header.meshes.filter((m) => m.receiver).length;
  console.log(`[export] ${header.meshes.length} meshes (${receivers} lit), ${Math.round(triangles / 1000)}k triangles, ${header.lights.length} lights, time=${time}`);
  await browser.close();
})();
