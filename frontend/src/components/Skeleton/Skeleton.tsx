/**
 * Content-shaped loading placeholder (docs/UI_DESIGN_SYSTEM.md —
 * LoadingState skeleton). Decorative: the surrounding region owns the
 * `role="status"` / live-region announcement, so each bar is
 * `aria-hidden`.
 */
export interface SkeletonProps {
  lines?: number;
  className?: string;
}

export function Skeleton({ lines = 3, className = "" }: SkeletonProps) {
  return (
    <div className={`skeleton ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton__bar" />
      ))}
    </div>
  );
}
