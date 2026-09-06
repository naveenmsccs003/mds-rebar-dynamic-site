import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

import { FOOTER_NAV, PRIMARY_NAV } from "./navItems";

/**
 * Header / footer chrome for every public route (docs/UI_DESIGN_SYSTEM.md).
 * Accessibility: a skip link, labelled landmarks, a keyboard-operable
 * mobile menu toggle (`aria-expanded` / `aria-controls`), and focus moved
 * to `<main>` on route change so keyboard/SR users aren't stranded at the
 * top of the nav.
 */
export function PublicLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const mountedPath = useRef(location.pathname);

  // Close the mobile menu the instant the route changes (adjust-state-
  // during-render pattern — no effect needed).
  const [seenPath, setSeenPath] = useState(location.pathname);
  if (seenPath !== location.pathname) {
    setSeenPath(location.pathname);
    setMenuOpen(false);
  }

  // Move focus to <main> on navigation so keyboard / screen-reader users
  // land on the new page's content, not the top of the nav.
  useEffect(() => {
    if (mountedPath.current === location.pathname) return;
    mountedPath.current = location.pathname;
    mainRef.current?.focus();
  }, [location.pathname]);

  return (
    <div className="public-layout">
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className="public-layout__header">
        <div className="public-layout__bar">
          <Link to="/" className="public-layout__logo">
            MDS Rebar
          </Link>

          <button
            type="button"
            className="public-layout__menu-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            {menuOpen ? "Close menu" : "Menu"}
          </button>

          <nav
            id="primary-nav"
            aria-label="Primary"
            className={`public-nav ${menuOpen ? "public-nav--open" : ""}`.trim()}
          >
            <ul className="public-nav__list">
              {PRIMARY_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      isActive ? "public-nav__link public-nav__link--active" : "public-nav__link"
                    }
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
              <li>
                <Link to="/request-quote" className="button button--primary public-nav__cta">
                  Request a Quote
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <main id="main-content" ref={mainRef} tabIndex={-1} className="public-layout__main">
        <Outlet />
      </main>

      <footer className="public-layout__footer">
        <div className="public-footer__cols">
          {FOOTER_NAV.map((col) => (
            <nav key={col.heading} aria-label={col.heading} className="public-footer__col">
              <h2 className="public-footer__heading">{col.heading}</h2>
              <ul>
                {col.items.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <p className="public-footer__legal">
          © {new Date().getFullYear()} MDS Rebar. Accuracy · Experience · Sustainability · Integrity.
        </p>
      </footer>
    </div>
  );
}
