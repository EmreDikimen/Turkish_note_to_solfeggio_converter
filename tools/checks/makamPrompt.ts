/**
 * Dismiss the app's post-decode makam prompt, for the Playwright smoke checks.
 *
 * Why this exists as a shared helper rather than four inline copies: the prompt is a modal with a
 * full-viewport backdrop (`apps/web/src/MakamModal.tsx`), so any click a smoke check makes after a
 * decode — Sheet, Play, Save JSON — fails with "element intercepts pointer events" until it is
 * closed. Every check that decodes and then clicks needs the same two lines, and they must agree
 * on the ids; one place is how they stay agreed.
 *
 * It accepts the app's own guess (`#makam-confirm`) rather than choosing "play as written",
 * because that is the path a user takes and therefore the one worth exercising. WHICH makam it
 * guessed is not a smoke concern — that is `docs/MANUAL_CHECKS.md` check 14.
 *
 * A no-op when no prompt is up (loading a sample never raises one), so it is safe to call
 * unconditionally.
 */
import type { Page } from "playwright";

export async function dismissMakamPrompt(page: Page): Promise<boolean> {
  const modal = page.locator("#makam-modal");
  if ((await modal.count()) === 0) return false;
  const makam = (await page.locator("#makam-modal-select").inputValue().catch(() => "")) || "none";
  await page.locator("#makam-confirm").click();
  await modal.waitFor({ state: "detached", timeout: 10000 });
  console.log(`  makam prompt: accepted "${makam}"`);
  return true;
}
