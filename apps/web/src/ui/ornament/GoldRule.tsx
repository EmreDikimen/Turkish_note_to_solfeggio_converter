import { Star } from "./Star";

/**
 * A gold hairline with a star knotted into it — the ruled line an illuminator draws under a
 * heading (the page's header, and the footer's top edge). The lines fade out towards the ends so
 * the rule reads as drawn rather than as a border.
 *
 * `align="start"` puts the knot near the left, under a left-set heading; `center` for a divider.
 */
export function GoldRule({ align = "center", className = "" }: { align?: "start" | "center"; className?: string }) {
  const fadeIn = "h-px flex-1 bg-linear-to-r from-transparent to-gold/70";
  const fadeOut = "h-px flex-1 bg-linear-to-r from-gold/70 to-transparent";
  return (
    <div aria-hidden="true" className={`flex items-center gap-2 text-gold ${className}`}>
      {align === "center" ? <span className={fadeIn} /> : <span className="h-px w-6 bg-gold/70" />}
      <Star size={11} />
      <span className="h-px w-1.5 bg-gold/70" />
      <Star size={7} className="opacity-80" />
      <span className="h-px w-1.5 bg-gold/70" />
      <Star size={11} />
      <span className={fadeOut} />
    </div>
  );
}
