import { Fragment } from "react";
import { Link } from "react-router-dom";

/**
 * Breadcrumb trail (docs/UI_DESIGN_SYSTEM.md). The last crumb is the
 * current page and is not a link; the <nav> is labelled for assistive
 * tech and the current item carries `aria-current="page"`.
 */
export interface Crumb {
  label: string;
  to?: string;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  if (items.length === 0) return null;
  return (
    <nav aria-label="Breadcrumb" className="breadcrumbs">
      <ol className="breadcrumbs__list">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li className="breadcrumbs__item">
                {item.to && !isLast ? (
                  <Link to={item.to}>{item.label}</Link>
                ) : (
                  <span aria-current={isLast ? "page" : undefined}>{item.label}</span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true" className="breadcrumbs__sep">
                  /
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
