#!/usr/bin/env bun
/**
 * Measure the shipped web embed with the real animation clock.
 * This is a performance probe, not the deterministic frame-verification clock.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const skillDir = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(dirname(skillDir)));
const scenario = process.argv[2] ?? "embed";
let runs = 7;
let sampleMs = 5000;

for (let index = 3; index < process.argv.length; index += 1) {
  const argument = process.argv[index];
  if (argument === "--runs") runs = Number.parseInt(process.argv[++index] ?? "", 10);
  else if (argument === "--sample-ms") sampleMs = Number.parseInt(process.argv[++index] ?? "", 10);
  else throw new Error(`unknown argument: ${argument}`);
}

if (!Number.isInteger(runs) || runs < 5) throw new Error("--runs must be an integer >= 5");
if (!Number.isInteger(sampleMs) || sampleMs < 2000) {

  throw new Error("--sample-ms must be an integer >= 2000");
}

const scenarios = {
  embed: "?trainType=d51&messages=%5B%22PERFCAR-A%22%2C%22PERFCAR-B%22%5D&accident=false",
  "embed-logo": "?trainType=logo&messages=%5B%5D",
  "embed-accident": "?trainType=d51&messages=%5B%22PERFCAR-A%22%5D&accident=true",
  "embed-fly": "?trainType=d51&messages=%5B%22PERFCAR-A%22%5D&fly=true",
};
const query = scenarios[scenario];
if (!query) throw new Error(`unknown scenario: ${scenario} (choose ${Object.keys(scenarios).join(", ")})`);

const port = Number(process.env.PLAYWRIGHT_PORT ?? 4173);
const base = `http://127.0.0.1:${port}`;
const isServerReady = () =>
  fetch(`${base}/sl/`)
    .then((response) => response.ok)
    .catch(() => false);

if (await isServerReady()) {
  throw new Error(`refusing to profile an existing server on ${base}`);
}

const server = Bun.spawn([process.execPath, "playwright-server.mjs"], {
  cwd: join(repoRoot, "apps/page"),
  env: { ...process.env, PLAYWRIGHT_PORT: String(port) },
  stdout: "ignore",
  stderr: "inherit",
});
for (let attempt = 0; attempt < 60 && !(await isServerReady()); attempt += 1) {
  if (server.exitCode !== null) {
    throw new Error(`performance server exited before answering on ${base}`);
  }

  await Bun.sleep(500);
}

if (!(await isServerReady())) {
  server.kill();
  throw new Error(`performance server did not answer on ${base} within 30s`);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const evidenceDir = join(skillDir, "evidence", `${stamp}-web-${scenario}`);
mkdirSync(evidenceDir, { recursive: true });

const samples = [];
const pageErrors = [];

let browser = null;

try {
  browser = await chromium.launch({ headless: true });
  for (let run = 0; run < runs; run += 1) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => pageErrors.push({ run, message: error.message }));
    await page.addInitScript(measureAnimationCallbacks);
    await page.goto(`${base}/sl/embed.html${query}`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1000);
    await page.evaluate(() => window.__slPerformance.reset());
    await page.waitForTimeout(sampleMs);
    const sample = await page.evaluate(() => {
      const grid = document.querySelector('[role="img"][aria-label*="Animated ASCII art"]');
      return {
        ...window.__slPerformance.snapshot(),
        gridText: grid?.textContent ?? "",
      };
    });
    samples.push({
      ...summarizeRun(sample),
      raw: {
        callbackDurationsMs: sample.callbackDurationsMs,
        frameIntervalsMs: sample.frameIntervalsMs,
        longTasksMs: sample.longTasksMs,
      },
    });
    await context.close();
  }
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    server.kill();
  }
}

if (pageErrors.length > 0) throw new Error(`page errors: ${JSON.stringify(pageErrors)}`);
const report = {
  scenario,
  runs,
  sampleMs,
  viewport: { width: 1280, height: 900 },
  summary: summarizeRuns(samples),
  samples,
};
writeFileSync(join(evidenceDir, "results.json"), JSON.stringify(report, null, 2));
console.log(evidenceDir);
console.log(JSON.stringify(report.summary, null, 2));

function measureAnimationCallbacks() {
  const state = {
    callbackDurationsMs: [],
    frameIntervalsMs: [],
    longTasksMs: [],
    lastTimestamp: null,
    locomotiveArtSeen: false,
  };
  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (callback) =>
    nativeRequestAnimationFrame((timestamp) => {
      if (state.lastTimestamp !== null) {
        state.frameIntervalsMs.push(timestamp - state.lastTimestamp);
      }
      state.lastTimestamp = timestamp;
      const started = performance.now();
      try {
        return callback(timestamp);
      } finally {
        state.callbackDurationsMs.push(performance.now() - started);
        const grid = document.querySelector('[role="img"][aria-label*="Animated ASCII art"]');
        const gridText = grid?.textContent ?? "";
        state.locomotiveArtSeen ||= /_D _\||\+------/.test(gridText);
      }
    });
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) state.longTasksMs.push(entry.duration);
  });
  observer.observe({ entryTypes: ["longtask"] });
  window.__slPerformance = {
    reset() {
      state.callbackDurationsMs.length = 0;
      state.frameIntervalsMs.length = 0;
      state.longTasksMs.length = 0;
      state.lastTimestamp = null;
      state.locomotiveArtSeen = false;
    },
    snapshot() {
      return {
        callbackDurationsMs: [...state.callbackDurationsMs],
        frameIntervalsMs: [...state.frameIntervalsMs],
        longTasksMs: [...state.longTasksMs],
        locomotiveArtSeen: state.locomotiveArtSeen,
      };
    },
  };
}

function summarizeRun(sample) {
  const rendered =
    sample.callbackDurationsMs.length >= 20 &&
    sample.locomotiveArtSeen &&
    !sample.gridText.includes("Failed to load animation");

  if (!rendered) throw new Error("work/output check failed: animation did not render enough frames");
  return {
    frames: sample.callbackDurationsMs.length,
    callbackP50Ms: percentile(sample.callbackDurationsMs, 0.5),
    callbackP95Ms: percentile(sample.callbackDurationsMs, 0.95),
    intervalP50Ms: percentile(sample.frameIntervalsMs, 0.5),
    intervalP95Ms: percentile(sample.frameIntervalsMs, 0.95),
    longTaskCount: sample.longTasksMs.length,
    longTaskP95Ms: percentile(sample.longTasksMs, 0.95),
  };
}

function summarizeRuns(samples) {
  return {
    frames: range(samples.map((sample) => sample.frames)),
    callbackP50Ms: range(samples.map((sample) => sample.callbackP50Ms)),
    callbackP95Ms: range(samples.map((sample) => sample.callbackP95Ms)),
    intervalP50Ms: range(samples.map((sample) => sample.intervalP50Ms)),
    intervalP95Ms: range(samples.map((sample) => sample.intervalP95Ms)),
    longTaskCount: range(samples.map((sample) => sample.longTaskCount)),
    longTaskP95Ms: range(samples.map((sample) => sample.longTaskP95Ms)),
  };
}

function percentile(values, quantile) {
  if (values.length === 0) return null;

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * quantile) - 1);

  return sorted[index];
}

function range(values) {
  const sorted = values.filter((value) => value !== null).sort((left, right) => left - right);

  if (sorted.length === 0) return { median: null, min: null, max: null };

  return {
    median: percentile(sorted, 0.5),
    min: sorted[0],
    max: sorted.at(-1),
  };
}
