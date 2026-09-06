import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Hairline-bordered content card (docs/UI_DESIGN_SYSTEM.md — subtle 1px
 * borders, low elevation, no over-rounded corners). Renders as a link
 * when `to` is given, keeping the whole card keyboard-focusable.
 */
export interface CardProps {
  title: string;
  children?: ReactNode;
  to?: string;
  eyebrow?: string;
}

export function Card({ title, children, to, eyebrow }: CardProps) {
  const body = (
    <>
      {eyebrow && <p className="card__eyebrow">{eyebrow}</p>}
      <h3 className="card__title">{title}</h3>
      {children && <div className="card__body">{children}</div>}
    </>
  );

  if (to) {
    return (
      <Link className="card card--link" to={to}>
        {body}
      </Link>
    );
  }
  return <div className="card">{body}</div>;
}
