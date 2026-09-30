/**
 * Open and close the player bar's settings panel, for the Playwright checks (UI rebuild,
 * 2026-09-30).
 *
 * Why a helper: the sound / rhythm / pitch controls (`#instrument`, `#percussion`,
 * `#percussion-kit`, `#makam-select`, …) live in a Base UI Drawer that is NOT MOUNTED while closed,
 * so a check must open it before touching them — and close it before clicking the score, because on
 * a wide window the panel covers the right-hand 380px of the page. Every caller must agree on the
 * ids, so they live in one place, like `makamPrompt.ts` and `voicePrompt.ts`.
 *
 * Both are no-ops when the panel is already in the wanted state.
 */
import type { Page } from "playwright";

export async function openSettings(page: Page): Promise<void> {
  if (await page.locator("#transport-settings").count()) return;
  await page.locator("#settings-open").click();
  await page.locator("#transport-settings").waitFor({ state: "visible", timeout: 10000 });
  // the slide-in: let it settle so a click lands where the control will stay
  await page.waitForTimeout(350);
}

export async function closeSettings(page: Page): Promise<void> {
  if ((await page.locator("#transport-settings").count()) === 0) return;
  await page.locator("#settings-close").click();
  await page.locator("#transport-settings").waitFor({ state: "detached", timeout: 10000 });
}
