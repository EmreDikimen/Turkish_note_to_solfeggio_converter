/** A segmented control. One highlighted choice out of a few — never more than four. */

export function Segmented<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (v: T) => void;
  /** `id` is optional and exists so the deploy checks can click a segment by id, not by label. */
  items: { value: T; label: string; id?: string; title?: string }[];
}) {
  return (
    <span className="kv-seg">
      {items.map((it) => (
        <button
          key={it.value}
          id={it.id}
          type="button"
          title={it.title}
          aria-pressed={value === it.value}
          className={`kv-seg__btn${value === it.value ? " is-active" : ""}`}
          onClick={() => onChange(it.value)}
        >
          {it.label}
        </button>
      ))}
    </span>
  );
}
