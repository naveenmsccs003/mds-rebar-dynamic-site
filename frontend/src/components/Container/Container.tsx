import type { ElementType, ReactNode } from "react";

/**
 * Centres content at the design-system max width with consistent gutters
 * (docs/UI_DESIGN_SYSTEM.md — 12-col grid, consistent spacing scale).
 */
export interface ContainerProps {
  children: ReactNode;
  as?: ElementType;
  size?: "default" | "narrow" | "wide";
  className?: string;
}

export function Container({ children, as: Tag = "div", size = "default", className = "" }: ContainerProps) {
  return (
    <Tag className={`container container--${size} ${className}`.trim()}>{children}</Tag>
  );
}
