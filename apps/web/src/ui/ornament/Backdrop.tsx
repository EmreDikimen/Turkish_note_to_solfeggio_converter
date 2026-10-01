/**
 * The Istanbul painting behind the page (owner, 2026-10-01): Aivazovsky by day, Aivazovsky by
 * moonlight (`scripts/prepare_backdrop.py`). Three layers, all CSS (`.kv-backdrop` in app.css):
 * the painting, a blurred copy masked to the content column, and a veil of the page's own paper
 * that is thickest behind the content — so the picture is soft where something is read over it
 * and comes through more clearly toward the window's edges.
 *
 * Fixed behind everything and pointer-transparent. A render job hides it with all other chrome
 * (contract.css: `#app > :not(.kv-card)`), and `.kv-score` paints its own sheet over it anyway.
 */
export function Backdrop() {
  return (
    <div className="kv-backdrop" aria-hidden="true">
      <div className="kv-backdrop__sharp" />
      <div className="kv-backdrop__soft" />
    </div>
  );
}
