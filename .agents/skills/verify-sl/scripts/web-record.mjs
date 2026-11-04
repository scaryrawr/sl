#!/usr/bin/env bun
/**
 * Record real-time (no pump patch) web demo videos and convert them to GIFs.
 * This is deliberately NOT the deterministic verifier - it shows what a human
 * visitor sees, so reviewers can sanity-check the recorded evidence itself.
 *
 * Capture method: clipped page screenshots at ~15 Hz assembled by the system
 * ffmpeg. (Playwright's own recordVideo needs a separate bundled ffmpeg
 * artifact whose installer hangs in this environment; screenshots avoid it.)
 *
 * Usage: bun web-record.mjs <out-dir> [scenario ...]
 * Scenarios: d51 | accident | fly   (default: all three)
 * Requires the verification server (starts its own if nothing answers).
 */
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const skillDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(dirname(skillDir)));
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const base = `http://127.0.0.1:${port}`;
const outDir = process.argv[2];
if (!outDir) {
  console.error("usage: web-record.mjs <out-dir> [d51|accident|fly ...]");
  process.exit(2);
}
const SCENARIOS = {
  d51: "?trainType=d51&messages=%5B%22VERIFCAR-A%22%2C%22VERIFCAR-B%22%5D",
  accident: "?trainType=d51&accident=true&messages=%5B%22VERIFCAR-A%22%5D",
  fly: "?trainType=d51&fly=true&messages=%5B%22VERIFCAR-A%22%5D",
};
const wanted = process.argv.slice(3).length ? process.argv.slice(3) : Object.keys(SCENARIOS);

const portOpen = () =>
  fetch(`${base}/sl/`).then((r) => r.ok).catch(() => false);
let server = null;
if (!(await portOpen())) {
  server = Bun.spawn([process.execPath, "playwright-server.mjs"], {
    cwd: join(repoRoot, "apps/page"),
    env: { ...process.env, PLAYWRIGHT_PORT: String(port) },
    stdout: "ignore",
    stderr: "inherit",
  });
  for (let i = 0; i < 60 && !(await portOpen()); i += 1) await Bun.sleep(500);
  if (!(await portOpen())) {
    server.kill();
    throw new Error(`verification server did not answer on ${base}`);
  }
}

const browser = await chromium.launch({ headless: true });
try {
  for (const name of wanted) {
    if (!SCENARIOS[name]) throw new Error(`unknown scenario: ${name}`);
    const shotDir = mkdtempSync("/tmp/sl-record-");
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${base}/sl/embed.html${SCENARIOS[name]}`, { waitUntil: "networkidle" });
    const grid = page.locator('[role="img"][aria-label*="Animated ASCII art"]');
    await grid.waitFor();
    const box = await grid.boundingBox();
    // Sample the live animation at the page's own pace for ~10s of wall time.
    for (let shot = 0; shot < 100; shot += 1) {
      await page.screenshot({
        path: join(shotDir, `f-${String(shot).padStart(4, "0")}.png`),
        clip: box,
      });
      await page.waitForTimeout(40);
    }
    await context.close();
    const gif = join(outDir, `web-${name}.gif`);
    const vf = "scale=720:-1:flags=lanczos";
    const input = join(shotDir, "f-%04d.png");
    const pal = join(shotDir, "pal.png");
    Bun.spawnSync(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "15", "-i", input, "-vf", `${vf},palettegen=stats_mode=diff`, pal]);
    const done = Bun.spawnSync(["ffmpeg", "-y", "-loglevel", "error", "-framerate", "15", "-i", input, "-i", pal, "-lavfi", `${vf}[x];[x][1:v]paletteuse=dither=bayer`, gif]);
    if (done.exitCode !== 0) throw new Error(`ffmpeg failed for ${name}: ${done.stderr.toString()}`);
    console.log(`wrote ${gif}`);
  }
} finally {
  await browser.close();
  if (server) server.kill();
}
