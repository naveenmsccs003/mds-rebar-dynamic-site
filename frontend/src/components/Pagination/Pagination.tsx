/**
 * Page navigation for server-paginated lists (docs/UI_DESIGN_SYSTEM.md).
 * Renders nothing for a single page. Keyboard-operable, labelled, and
 * marks the current page with `aria-current`.
 */
export interface PaginationProps {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}

export function Pagination({ page, pageCount, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;

  const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

  return (
    <nav aria-label="Pagination" className="pagination">
      <button
        type="button"
        className="button button--secondary"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        Previous
      </button>
      <ul className="pagination__list">
        {pages.map((p) => (
          <li key={p}>
            <button
              type="button"
              className={p === page ? "pagination__page pagination__page--active" : "pagination__page"}
              aria-current={p === page ? "page" : undefined}
              onClick={() => onChange(p)}
            >
              {p}
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="button button--secondary"
        onClick={() => onChange(page + 1)}
        disabled={page >= pageCount}
      >
        Next
      </button>
    </nav>
  );
}
