export function PomegranateMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`pomegranate-mark${compact ? " mark-compact" : ""}`} aria-hidden="true">
      <span className="crown-leaf leaf-left" />
      <span className="crown-leaf leaf-center" />
      <span className="crown-leaf leaf-right" />
      <span className="fruit-shell">
        <i />
        <i />
        <i />
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

