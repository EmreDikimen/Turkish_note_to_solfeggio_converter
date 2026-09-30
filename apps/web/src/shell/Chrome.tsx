/**
 * The small pieces of the shell's frame: the brand, the empty-state welcome, and the legal footer.
 * (UI rebuild, 2026-09-30.)
 *
 * ⚠ `#legal` is the DOM contract's, and its first line is a promise about the server
 * (apps/server/src/index.ts writes no image to disk) — the copy lives in strings.ts and moves with
 * that file, never on its own.
 */
import type { ReactNode } from "react";
import { TR } from "../ui/strings";
import { GoldRule } from "../ui/ornament/GoldRule";
import { TezhipPattern } from "../ui/ornament/TezhipPattern";

/** The wordmark: the koma sign in gold, the name in the display serif. */
export function Brand({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <h1 className={`kv-brand m-0 ${size === "lg" ? "text-(length:--text-3xl)" : "text-(length:--text-2xl)"}`}>
      <span className="kv-brand__mark" aria-hidden="true">
        &#xE282;
      </span>
      {TR.brand}
    </h1>
  );
}

/** What the main column shows before any page is open: a title page, with the upload under it. */
export function Welcome({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto flex max-w-2xl flex-col gap-6 pt-6 phone:pt-2">
      <div className="relative isolate overflow-clip rounded-(--radius-lg) px-2 pt-8 pb-2 text-center phone:pt-2 phone:text-left">
        <TezhipPattern className="-z-10 text-gold opacity-[0.07] phone:hidden [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="flex justify-center phone:justify-start">
          <Brand size="lg" />
        </div>
        <p className="kv-tagline mx-auto mt-3 phone:mx-0">{TR.tagline}</p>
        <GoldRule className="mx-auto mt-6 max-w-md phone:hidden" />
      </div>
      {children}
    </div>
  );
}

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <footer id="legal" className={`kv-footer mt-0! text-(length:--text-xs) leading-relaxed text-ink-faint ${className}`}>
      <GoldRule className="kv-footer__rule mb-4" />
      <p>{TR.footer.privacy}</p>
      <p>{TR.footer.counting}</p>
      <p>{TR.footer.rights}</p>
      <p>
        {TR.footer.contactLabel}{" "}
        <a href={TR.footer.contactHref} target="_blank" rel="noreferrer noopener">
          {TR.footer.contactText}
        </a>
        {" · "}
        <a href={TR.footer.noticesHref} target="_blank" rel="noreferrer noopener">
          {TR.footer.noticesText}
        </a>
      </p>
    </footer>
  );
}

/** A caption over a group in the sidebar. */
export function SideHeading({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2 px-1 font-sans text-(length:--text-xs) font-semibold tracking-[0.12em] text-ink-faint uppercase">
      {children}
    </h2>
  );
}
