import { chromium, devices } from "playwright";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const gameUrl = pathToFileURL(resolve("index.html")).href;
const rounds = Number(process.env.PLAYTEST_ROUNDS || 10);

const profiles = [
  { name: "desktop", viewport: { width: 1280, height: 820 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
  { name: "iphone-portrait", ...devices["iPhone 14"] },
  { name: "iphone-landscape", ...devices["iPhone 14 landscape"] },
  { name: "ipad-portrait", ...devices["iPad Pro 11"] },
  { name: "ipad-landscape", ...devices["iPad Pro 11 landscape"] }
];

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

async function withPage(browser, profile, testName, fn, options = {}) {
  const context = await browser.newContext(profile);
  context.setDefaultTimeout(8000);
  context.setDefaultNavigationTimeout(8000);

  const consoleErrors = [];
  const pageErrors = [];
  const suspiciousRequests = [];

  await context.addInitScript(({ blockStorage }) => {
    window.__pokiEvents = [];
    window.PokiSDK = {
      init() {
        window.__pokiEvents.push("init");
        return Promise.resolve();
      },
      gameLoadingFinished() {
        window.__pokiEvents.push("gameLoadingFinished");
      },
      gameplayStart() {
        window.__pokiEvents.push("gameplayStart");
      },
      gameplayStop() {
        window.__pokiEvents.push("gameplayStop");
      },
      commercialBreak() {
        window.__pokiEvents.push("commercialBreak");
        return Promise.resolve();
      },
      movePill(x, y) {
        window.__pokiEvents.push(`movePill:${x}:${y}`);
      }
    };

    if (blockStorage) {
      for (const method of ["getItem", "setItem", "removeItem"]) {
        Object.defineProperty(Storage.prototype, method, {
          configurable: true,
          value() {
            throw new Error("localStorage disabled by playtest");
          }
        });
      }
    }
  }, { blockStorage: Boolean(options.blockStorage) });

  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const url = request.url();
    if (/(save|storage|account|login|leaderboard|profile|user)/i.test(url) && !url.startsWith("file:")) {
      suspiciousRequests.push(url);
    }
  });
  await page.route("https://game-cdn.poki.com/scripts/v2/poki-sdk.js", (route) => {
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" });
  });

  try {
    await fn(page);
    expect(consoleErrors.length === 0, `${testName} console errors: ${consoleErrors.join(" | ")}`);
    expect(pageErrors.length === 0, `${testName} page errors: ${pageErrors.join(" | ")}`);
    expect(suspiciousRequests.length === 0, `${testName} suspicious save/account requests: ${suspiciousRequests.join(" | ")}`);
  } finally {
    await context.close();
  }
}

async function openGame(page) {
  await page.goto(gameUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#game");
  await page.waitForFunction(() => window.__pokiEvents?.includes("gameLoadingFinished"), null, { timeout: 3000 });
}

async function assertCanvasPainted(page, label) {
  const painted = await page.locator("#game").evaluate((canvas) => {
    const context = canvas.getContext("2d");
    const sample = context.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;
    return sample[3] > 0;
  });
  expect(painted, `${label} canvas did not paint`);
}

async function assertControlsFit(page, label) {
  const result = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const elements = [...document.querySelectorAll("button, canvas, .stats, .wallet, .goal")]
      .filter((element) => element.offsetParent !== null);
    return elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        text: element.textContent.trim() || element.id || element.className,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        ok: rect.left >= -2 && rect.top >= -2 && rect.right <= viewportWidth + 2 && rect.bottom <= viewportHeight + 2
      };
    });
  });
  const bad = result.filter((item) => !item.ok);
  expect(bad.length === 0, `${label} visible elements outside viewport: ${JSON.stringify(bad)}`);
}

async function startGame(page) {
  await page.locator("#play").click();
  await page.waitForFunction(() => document.querySelector("#curtain").classList.contains("hidden"), null, { timeout: 3000 });
  await page.waitForTimeout(180);
}

async function tapUpperCanvasThroughHud(page, label) {
  const beforeHeight = await page.locator("#height").textContent();
  const hudIgnoresPointers = await page.evaluate(() => {
    return getComputedStyle(document.querySelector("#goal")).pointerEvents === "none"
      && getComputedStyle(document.querySelector("#wallet")).pointerEvents === "none";
  });
  expect(hudIgnoresPointers, `${label} floating HUD labels can intercept canvas taps`);
  const box = await page.locator("#game").boundingBox();
  expect(Boolean(box), `${label} canvas bounds unavailable`);
  await page.mouse.click(box.x + Math.min(80, box.width / 2), box.y + Math.min(86, box.height / 2));
  await page.waitForTimeout(180);
  const afterHeight = await page.locator("#height").textContent();
  const gameOver = await page.locator("#curtain:not(.hidden)").count();
  expect(afterHeight !== beforeHeight || gameOver > 0, `${label} upper canvas tap did not reach gameplay`);
  if (gameOver) {
    await page.locator("#play").click();
    await page.waitForFunction(() => document.querySelector("#curtain").classList.contains("hidden"), null, { timeout: 3000 });
    await page.waitForTimeout(100);
  }
}

async function playDrops(page, count) {
  for (let index = 0; index < count; index += 1) {
    await page.locator("#drop").dispatchEvent("pointerdown", { pointerType: "touch", button: 0 });
    await page.waitForTimeout(120 + ((index * 83) % 260));
    const curtainVisible = await page.locator("#curtain:not(.hidden)").count();
    if (curtainVisible) {
      await page.locator("#play").click();
      await page.waitForFunction(() => document.querySelector("#curtain").classList.contains("hidden"), null, { timeout: 3000 });
      await page.waitForTimeout(100);
    }
  }
}

async function gameplaySmoke(browser, profile) {
  await withPage(browser, profile, `gameplay ${profile.name}`, async (page) => {
    await openGame(page);
    await assertCanvasPainted(page, profile.name);
    await assertControlsFit(page, profile.name);
    await startGame(page);
    await tapUpperCanvasThroughHud(page, profile.name);
    await playDrops(page, rounds);

    const score = Number(await page.locator("#score").textContent());
    const height = await page.locator("#height").textContent();
    const events = await page.evaluate(() => window.__pokiEvents);
    expect(score >= 0, `${profile.name} score became invalid`);
    expect(/^\d+\/\d+$/.test(height), `${profile.name} invalid height text: ${height}`);
    expect(events.includes("commercialBreak"), `${profile.name} did not call Poki commercialBreak`);
    expect(events.includes("gameplayStart"), `${profile.name} did not call Poki gameplayStart`);
  });
  console.log(`PASS ${profile.name} gameplay/touch/layout`);
}

async function shopAndPersistence(browser) {
  await withPage(browser, profiles[0], "shop persistence", async (page) => {
    await page.addInitScript(() => {
      localStorage.setItem("color-stack-coins", "220");
      localStorage.setItem("color-stack-best", "42");
      localStorage.setItem("color-stack-best-height", "9");
    });
    await openGame(page);
    await page.locator("#shop").click();
    await page.locator(".shop-item", { hasText: "Sunset Pop" }).locator("button").click();
    await page.locator(".shop-item", { hasText: "Candy Blocks" }).locator("button").click();
    await page.locator("#shopClose").click();
    await page.locator("#mute").click();

    let saved = await page.evaluate(() => ({
      background: localStorage.getItem("color-stack-background"),
      blocks: localStorage.getItem("color-stack-block-theme"),
      ownedBackgrounds: localStorage.getItem("color-stack-owned-backgrounds"),
      ownedBlocks: localStorage.getItem("color-stack-owned-blocks"),
      muted: localStorage.getItem("color-stack-muted")
    }));
    expect(saved.background === "sunset", `background did not save: ${JSON.stringify(saved)}`);
    expect(saved.blocks === "candy", `block theme did not save: ${JSON.stringify(saved)}`);
    expect(saved.ownedBackgrounds.includes("sunset"), `owned background missing: ${saved.ownedBackgrounds}`);
    expect(saved.ownedBlocks.includes("candy"), `owned blocks missing: ${saved.ownedBlocks}`);
    expect(saved.muted === "1", `mute did not save: ${JSON.stringify(saved)}`);

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForSelector("#game");
    await page.locator("#shop").click();
    saved = await page.evaluate(() => ({
      best: document.querySelector("#best").textContent,
      height: document.querySelector("#height").textContent,
      backgroundButton: [...document.querySelectorAll(".shop-item")].find((item) => item.textContent.includes("Sunset Pop"))?.querySelector("button")?.textContent,
      blockButton: [...document.querySelectorAll(".shop-item")].find((item) => item.textContent.includes("Candy Blocks"))?.querySelector("button")?.textContent
    }));
    expect(saved.backgroundButton === "Selected", `background not selected after reload: ${JSON.stringify(saved)}`);
    expect(saved.blockButton === "Selected", `block theme not selected after reload: ${JSON.stringify(saved)}`);
    expect(saved.best === "42", `best score not restored: ${JSON.stringify(saved)}`);
    expect(saved.height === "1/9", `best height not restored: ${JSON.stringify(saved)}`);
  });
  console.log("PASS shop persistence and device-only save checks");
}

async function storageBlockedFallback(browser) {
  await withPage(browser, profiles[1], "storage blocked fallback", async (page) => {
    await openGame(page);
    await startGame(page);
    await playDrops(page, 5);
    await page.locator("#shop").click();
    await expect(await page.locator("#shopClose").isVisible(), "storage blocked shop close button is not visible");
    await page.locator(".shop-card").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await expect(await page.locator(".shop-item", { hasText: "Ember Blocks" }).locator("button").isVisible(), "storage blocked shop did not scroll to lower items");
    await page.locator("#shopClose").click();
  }, { blockStorage: true });
  console.log("PASS localStorage unavailable fallback");
}

async function run() {
  const browser = await chromium.launch();
  try {
    for (const profile of profiles) {
      await gameplaySmoke(browser, profile);
    }
    await shopAndPersistence(browser);
    await storageBlockedFallback(browser);
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
