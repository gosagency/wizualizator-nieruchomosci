/** Required label on every render, model and clip (CLAUDE.md, rule 4). */
export function PreviewBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-current/20 bg-background/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur ${className}`}
    >
      Wizualizacja poglądowa
    </span>
  );
}
