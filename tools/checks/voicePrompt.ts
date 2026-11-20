/**
 * Answer the app's "download this voice?" question, for the Playwright checks.
 *
 * Why a shared helper: the question is a modal with a full-viewport backdrop
 * (`apps/web/src/VoiceDownloadModal.tsx`), raised whenever a recorded voice would start
 * downloading — picking one in the transport, picking an instrument on the instrument page, and
 * merely OPENING that page. Any click a check makes after one of those fails with "element
 * intercepts pointer events" until it is answered, and every caller must agree on the ids.
 * `makamPrompt.ts` exists for the same reason.
 *
 * A no-op when nothing is asked (the synthesised tone, or a voice already said yes to in this
 * visit), so it is safe to call unconditionally. It waits briefly because the question is raised
 * by the same click that the caller just made.
 */
import type { Page } from "playwright";

export async function answerVoicePrompt(page: Page, answer: "confirm" | "cancel"): Promise<string | null> {
  const modal = page.locator("#voice-modal");
  try {
    await modal.waitFor({ state: "attached", timeout: 1500 });
  } catch {
    return null;
  }
  const voice = await modal.getAttribute("data-voice");
  await page.locator(answer === "confirm" ? "#voice-confirm" : "#voice-cancel").click();
  await modal.waitFor({ state: "detached", timeout: 10000 });
  return voice;
}
