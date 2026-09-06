import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

/**
 * Baseline reusable Button — every feature button composes this rather
 * than styling a raw <button> inline (spec §57/§79 reusable component
 * requirement). Keeps a visible focus ring for keyboard users
 * (docs/UI_DESIGN_SYSTEM.md accessibility targets).
 */
export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  return <button className={`button button--${variant} ${className}`.trim()} {...props} />;
}
