"use client";

export function CornerFrame({
  children,
  label,
  tag,
  className = "",
}: {
  children: React.ReactNode;
  label?: string;
  tag?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      {/* corner brackets — instrument-panel framing, not a card */}
      <span className="absolute -top-px -left-px w-3 h-3 border-t border-l border-accent/70" />
      <span className="absolute -top-px -right-px w-3 h-3 border-t border-r border-accent/70" />
      <span className="absolute -bottom-px -left-px w-3 h-3 border-b border-l border-accent/70" />
      <span className="absolute -bottom-px -right-px w-3 h-3 border-b border-r border-accent/70" />

      {label && (
        <span className="absolute -top-2.5 left-3 bg-bg px-1.5 text-[9px] uppercase tracking-widest text-muted">
          {label}
        </span>
      )}
      {tag && (
        <span className="absolute -bottom-2.5 right-3 bg-bg px-1.5 text-[9px] uppercase tracking-widest text-muted font-mono">
          {tag}
        </span>
      )}

      <div className="px-6 py-6">{children}</div>
    </div>
  );
}
