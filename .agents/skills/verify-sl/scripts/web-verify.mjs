#!/usr/bin/env bun
/**
 * Drive the real web demo (built page served by apps/page/playwright-server.mjs)
 * in headless chromium and prove the train animation, accident mode, and car
 * labels render, frame by frame, exactly as a user sees them.
 *
 * Determinism trick: the page's animation loop advances one column per
 * requestAnimationFrame/setTimeout(60) tick. We patch both BEFORE the app
 * bundle loads, so every train step becomes an explicit `pump()` call and the
 * grid can be sampled after each step. No timing races.
 *
 * Usage: bun web-verify.mjs embed | embed-logo | embed-accident | embed-fly
 *            | reduced-motion | home-form
 * Exit 0 = all checks pass. Evidence (frames JSON + screenshots) is written
 * under evidence/<timestamp>-web-<label>/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const skillDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(dirname(skillDir))); // .agents/skills/verify-sl -> repo root
const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const base = `http://127.0.0.1:${port}`;
const scenario = process.argv[2];

const SCENARIOS = {
  embed: {
    query: "?trainType=d51&messages=%5B%22VERIFCAR-A%22%2C%22VERIFCAR-B%22%5D&accident=false",
    cars: ["VERIFCAR-", "VERIFCAR-B"],
    art: "_D _|",
    steps: 320,
  },
  "embed-logo": {
    query: "?trainType=logo&messages=%5B%22VERIFCAR-A%22%5D",
    cars: ["VERIFCAR-"],
    art: "+------",
    steps: 260,
  },
  "embed-accident": {
    query: "?trainType=d51&accident=true&messages=%5B%22VERIFCAR-A%22%5D",
    cars: ["VERIFCAR-"],
    art: "_D _|",
    accident: true,
    steps: 320,
  },
  "embed-fly": {
    query: "?trainType=d51&fly=true&messages=%5B%22VERIFCAR-A%22%5D",
    cars: ["VERIFCAR-"],
    art: "_D _|",
    fly: true,
    steps: 320,
  },
  "reduced-motion": { query: "?trainType=d51", steps: 0 },
  "home-form": { home: true, steps: 900 },
};

const config = SCENARIOS[scenario];
if (!config) {
  console.error(`unknown scenario: ${scenario} (choose: ${Object.keys(SCENARIOS).join(", ")})`);
  process.exit(2);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const evidenceDir = join(skillDir, "evidence", `${stamp}-web-${scenario}`);
mkdirSync(evidenceDir, { recursive: true });

const portOpen = () =>
  fetch(`${base}/sl/`)
    .then((response) => response.ok)
    .catch(() => false);
let server = null;
if (!(await portOpen())) {
  server = Bun.spawn([process.execPath, "playwright-server.mjs"], {
    cwd: join(repoRoot, "apps/page"),
    env: { ...process.env, PLAYWRIGHT_PORT: String(port) },
    stdout: "ignore",
    stderr: "inherit",
  });
  for (let attempt = 0; attempt < 60 && !(await portOpen()); attempt += 1) {
    await Bun.sleep(500);
  }
  if (!(await portOpen())) {
    server.kill();
    throw new Error(`verification server did not answer on ${base} within 30s`);
  }
}

let browser = null;
let context = null;
const results = [];
const check = (name, ok) => results.push([name, ok]);
try {
  // Launch inside the cleanup scope: a missing/incomplete browser must still
  // kill the verification server this run started.
  browser = await chromium.launch({ headless: true });
  context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    ...(scenario === "reduced-motion" ? { reducedMotion: "reduce" } : {}),
  });
  const page = await context.newPage();
  if (!config.home) await page.addInitScript(stepPatch);

  if (config.home) {
    await page.goto(`${base}/sl/`, { waitUntil: "networkidle" });
    const grid = page.locator('[role="img"][aria-label*="Animated ASCII art"]');
    const textarea = page.locator("#messages-textarea");
    // Real keystrokes (not fill(): the shipped Preact bundle does not react to
    // its synthetic input event). Toggle a checkbox afterwards to restart the
    // animation so the new labels ride the next train that enters.
    await textarea.click();
    await page.keyboard.press("ControlOrMeta+a");
    await page.keyboard.press("Delete");
    await textarea.pressSequentially("VERIFCAR-A\nVERIFCAR-B", { delay: 20 });
    await page.locator("#fly-checkbox").check();
    check(
      "form textarea shows piped messages",
      (await textarea.inputValue()).includes("VERIFCAR-A"),
    );
    check(
      "form has train type select",
      (await page.locator("#train-type-select").inputValue()) === "d51",
    );
    const frames = [];
    let shot = false;
    for (let step = 0; step < config.steps; step += 1) {
      await page.waitForTimeout(70);
      const text = await readGrid(page);
      frames.push(text);
      if (step === 80 && !shot) {
        await grid.screenshot({ path: join(evidenceDir, "terminal-step080.png") });
        shot = true;
      }
      if (text.includes("VERIFCAR-A") && text.includes("_D _|")) break;
    }
    writeFileSync(join(evidenceDir, "frames.json"), JSON.stringify({ frames }, null, 1));
    const blob = frames.join("\n");
    check("home: locomotive art animates", blob.includes("_D _|"));
    check("home: messages typed into form appear on cars", blob.includes("VERIFCAR-"));
    check("home: animation moved (distinct frames)", new Set(frames).size > 10);
  } else if (scenario === "reduced-motion") {
    await page.goto(`${base}/sl/embed.html${config.query}`, { waitUntil: "networkidle" });
    const grid = page.locator('[role="img"][aria-label*="Animated ASCII art"]');
    try {
      await expectText(page, "Static view - Animation disabled", 10000);
    } catch (error) {
      if (process.env.WEB_VERIFY_DEBUG) {
        console.log("DEBUG-static", JSON.stringify(await page.evaluate(() => ({
          url: location.href,
          reduce: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
          rows: document.querySelector('[role="img"]')?.children.length ?? -1,
          firstRows: Array.from(document.querySelector('[role="img"]')?.children ?? [])
            .map((r) => r.textContent.replace(/\u00a0/g, " "))
            .filter((r) => r.trim())
            .slice(0, 2),
        }))));
      }
      throw error;
    }
    const text = await readGrid(page);
    writeFileSync(join(evidenceDir, "frame-static.txt"), text);
    check("reduced-motion: static locomotive shown", text.includes("_D _|") || text.includes("+------"));
    check("reduced-motion: a11y note rendered", text.includes("Static view - Animation disabled"));
  } else {
    await page.goto(`${base}/sl/embed.html${config.query}`, { waitUntil: "networkidle" });
    const grid = page.locator('[role="img"][aria-label*="Animated ASCII art"]');
    await page.waitForFunction("window.__slPump !== undefined");
    if (process.env.WEB_VERIFY_DEBUG) {
      console.log("DEBUG", JSON.stringify(await page.evaluate(() => ({
        url: location.href,
        imgs: document.querySelectorAll('[role="img"]').length,
        firstLabel: document.querySelector('[role="img"]')?.getAttribute("aria-label") ?? null,
      }))));
    }
    const frames = [];
    let shot = false;
    for (let step = 0; step < config.steps; step += 1) {
      await page.evaluate("window.__slPump(1)");
      const text = await readGrid(page);
      frames.push(text);
      if (step === 100 && !shot) {
        await grid.screenshot({ path: join(evidenceDir, "terminal-step100.png") });
        shot = true;
      }
    }
    writeFileSync(join(evidenceDir, "frames.json"), JSON.stringify({ frames }, null, 1));
    const blob = frames.join("\n");
    check("no WASM load failure", !blob.includes("Failed to load animation"));
    check(`locomotive art rendered (${config.art})`, blob.includes(config.art));
    for (const car of config.cars ?? []) {
      check(`car label visible (${car})`, blob.includes(car));
    }
    check("animation advanced (distinct frames)", new Set(frames).size > 20);
    if (config.accident) {
      check("accident: people cry for help", blob.includes("Help!"));
    }
    if (config.fly) {
      const frameRows = (frame) => frame.split("\n").map((row) => row.trim());
      const lowEarly = frames.slice(5, 60).some((frame) => {
        const rows = frameRows(frame);
        return rows.slice(20).some((row) => row) && !rows.slice(0, 6).some((row) => row);
      });
      check("fly: train starts low on screen", lowEarly);
    }
    if (!config.accident) {
      check("no accident figures without accident mode", !blob.includes("Help!"));
    }
  }
} finally {
  if (context) await context.close();
  if (browser) await browser.close();
  if (server) server.kill();
}

/** Read the animation grid as newline-joined rows (each row is a child <div>). */
async function readGrid(page) {
  return page.evaluate(() => {
    const grid = document.querySelector('[role="img"][aria-label*="Animated ASCII art"]');
    if (!grid) return "";
    return Array.from(grid.children)
      .map((row) => row.textContent ?? "")
      .join("\n")
      .replace(/\u00a0/g, " ");
  });
}

async function expectText(page, text, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await readGrid(page);
    if (value.includes(text)) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for ${JSON.stringify(text)} in grid`);
}

function stepPatch() {
  // The app drives itself with animate -> setTimeout(60) -> requestAnimationFrame
  // -> animate. Queue ONLY the rAF callbacks (each one is one animation step);
  // the 60 ms timeout purely reschedules, so run it synchronously. A pump then
  // advances exactly one column instead of alternating draw/scheduling pumps.
  window.__slQueue = [];
  window.__slPump = (count) => {
    let pumped = 0;
    for (let n = 0; n < count; n += 1) {
      const pending = window.__slQueue.splice(0, window.__slQueue.length);
      if (pending.length === 0) break;
      // Consume exactly one queued animate(); any others (none expected) run too.
      const animate = pending.shift();
      for (const scheduler of pending) scheduler();
      animate(0);
      pumped += 1;
    }
    return pumped;
  };
  window.requestAnimationFrame = (callback) => {
    window.__slQueue.push(callback);
    return 0;
  };
  const realSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay, ...rest) => {
    if (delay === 60) {
      callback();
      return 0;
    }
    return realSetTimeout(callback, delay, ...rest);
  };
}

let failed = 0;
const width = Math.max(...results.map(([name]) => name.length));
for (const [name, ok] of results) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name.padEnd(width)}`);
  if (!ok) failed += 1;
}
console.log(`evidence: ${evidenceDir}`);
process.exit(failed === 0 ? 0 : 1);
