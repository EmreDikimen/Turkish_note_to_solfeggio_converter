/**
 * The app's one modal window, on Base UI's Dialog (Tezhip restyle, 2026-09-30). Three prompts use
 * it: the makam guess, the voice download and the violin tuning.
 *
 * What Base UI buys over the hand-rolled backdrop it replaced: focus moves into the window and is
 * trapped there, Esc closes it, the page underneath stops scrolling and is hidden from screen
 * readers, and focus goes back where it came from afterwards — none of which the old <div> did.
 *
 * ⚠ ALWAYS OPEN WHILE MOUNTED. The caller decides whether a prompt exists by rendering it or not;
 * this never animates itself out. That keeps the contract the browser checks rely on: a click on
 * `#makam-confirm` / `#voice-cancel` unmounts the window IMMEDIATELY, and their helpers wait for
 * the id to be `detached` (tools/browser/makamPrompt.ts, voicePrompt.ts).
 * ⚠ The `id` and the `data-*` attributes go on the POPUP — the element with `role="dialog"` — so
 * `#voice-modal[data-voice]` and `#tuning-modal[data-tuning]` still name the window a check asks.
 * ⚠ Esc and a click on the backdrop both mean `onDismiss`, as the old backdrop's click did.
 */
import { Dialog } from "@base-ui/react/dialog";
import type { ReactNode } from "react";
import { Star } from "../ornament/Star";

export function Modal({
  id,
  data,
  title,
  lead,
  onDismiss,
  actions,
  children,
}: {
  id: string;
  /** Extra attributes for the popup, e.g. `{ "data-voice": voice }` — the checks read them. */
  data?: Record<`data-${string}`, string | undefined>;
  title: ReactNode;
  lead?: ReactNode;
  onDismiss: () => void;
  /** The button row, right-aligned at the foot. */
  actions: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onDismiss();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-(--backdrop) backdrop-blur-[2px]" />
        <Dialog.Popup
          id={id}
          {...data}
          className={
            "kv-modal fixed top-1/2 left-1/2 z-[101] w-[min(560px,calc(100vw-2rem))] -translate-x-1/2 " +
            "-translate-y-1/2 overflow-auto rounded-(--radius-lg) border border-rule bg-raised text-ink " +
            "shadow-(--shadow-modal) outline-none " +
            // `dvh` for the phone: `vh` is the viewport with the URL bar HIDDEN, so a `vh` cap put the
            // buttons under the bar on a phone with it showing.
            "max-h-[85vh] max-h-[85dvh] p-6 phone:p-5"
          }
        >
          {/* The illuminator's knot above the title — the window belongs to the same book. */}
          <div aria-hidden="true" className="mb-3 flex items-center gap-2 text-gold">
            <Star size={12} />
            <span className="h-px flex-1 bg-linear-to-r from-gold/60 to-transparent" />
          </div>
          <Dialog.Title className="mb-2 font-serif text-(length:--text-xl) font-semibold leading-tight text-ink">
            {title}
          </Dialog.Title>
          {lead ? (
            <Dialog.Description className="mb-4 max-w-(--measure) text-(length:--text-sm) text-ink-soft">
              {lead}
            </Dialog.Description>
          ) : null}
          {children}
          <div className="mt-6 flex flex-wrap justify-end gap-2">{actions}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
