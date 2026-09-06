import { Outlet } from "react-router-dom";

/**
 * Shared header/footer chrome for every public route. The nav itself is
 * a static list here in Phase 1 (matching spec §7); its items become
 * CMS-driven in Phase 4/5 rather than hardcoded — this layout's shape
 * doesn't need to change when that happens.
 */
export function PublicLayout() {
  return (
    <div className="public-layout">
      <header className="public-layout__header">
        <span className="public-layout__logo">MDS Rebar</span>
      </header>
      <main className="public-layout__main">
        <Outlet />
      </main>
      <footer className="public-layout__footer">
        <p>© {new Date().getFullYear()} MDS Rebar</p>
      </footer>
    </div>
  );
}
