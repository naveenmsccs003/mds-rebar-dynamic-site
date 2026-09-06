/**
 * Public global search (spec §11 / docs/SEARCH.md). The query and the
 * type filter live in the URL (`/search?q=…&type=…`) so a result page is
 * shareable. Backed by `GET /api/v1/search/`.
 */
import { Link, useSearchParams } from "react-router-dom";

import { Button } from "../../components/Button/Button";
import { Container } from "../../components/Container/Container";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { PageState } from "../../components/PageState/PageState";
import { Pagination } from "../../components/Pagination/Pagination";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useSearch } from "./hooks";
import { SEARCH_TYPE_LABELS, type SearchType } from "./types";

const TYPES = Object.keys(SEARCH_TYPE_LABELS) as SearchType[];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const type = params.get("type") ?? "";
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);

  const query = useSearch(q, { type: type || undefined, page });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("q") ?? "").trim();
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set("q", value);
      else next.delete("q");
      next.delete("page");
      return next;
    });
  }

  function setType(value: string) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value) next.set("type", value);
      else next.delete("type");
      next.delete("page");
      return next;
    });
  }

  function setPage(p: number) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (p > 1) next.set("page", String(p));
      else next.delete("page");
      return next;
    });
  }

  return (
    <>
      <SEOHead
        title={q ? `Search: ${q}` : "Search"}
        description="Search MDS Rebar services, projects, news, resources and careers."
        canonicalPath="/search"
        noindex
      />
      <Container as="header" className="page-header">
        <h1 className="page-header__title">Search</h1>
      </Container>

      <Container>
        <form className="form" onSubmit={submit} role="search">
          <label className="form__field">
            <span>Search MDS Rebar</span>
            {/* `key` re-seeds the uncontrolled input when the URL query
                changes (e.g. back button), without a sync effect. */}
            <input
              key={q}
              type="search"
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="e.g. rebar detailing"
            />
          </label>
          <div className="filter-bar" role="group" aria-label="Result type">
            <label className="filter-bar__field">
              <span>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All</option>
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {SEARCH_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <Button type="submit">Search</Button>
        </form>
      </Container>

      {q.trim().length < 2 ? (
        <Container>
          <p className="list-count">Enter at least two characters to search.</p>
        </Container>
      ) : (
        <PageState
          query={query}
          isEmpty={(r) => r.results.length === 0}
          loadingState={
            <Container>
              <div role="status" aria-live="polite">
                <span className="sr-only">Searching…</span>
                <Skeleton lines={6} />
              </div>
            </Container>
          }
          emptyState={
            <Container>
              <EmptyState title={`Nothing matched “${q}”`} description="Try different or fewer words." />
            </Container>
          }
        >
          {(data) => (
            <Section>
              <p className="list-count">
                {data.count} {data.count === 1 ? "result" : "results"} for “{data.query}”
              </p>
              <ul className="search-results">
                {data.results.map((hit) => (
                  <li key={hit.url} className="search-result">
                    <p className="card__eyebrow">{SEARCH_TYPE_LABELS[hit.type]}</p>
                    <h2 className="card__title">
                      <Link to={hit.url}>{hit.title}</Link>
                    </h2>
                    {hit.snippet && <p className="card__body">{hit.snippet}</p>}
                  </li>
                ))}
              </ul>
              <Pagination page={data.page} pageCount={data.num_pages} onChange={setPage} />
            </Section>
          )}
        </PageState>
      )}
    </>
  );
}
