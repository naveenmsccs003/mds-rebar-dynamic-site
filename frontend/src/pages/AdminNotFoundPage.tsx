import { Link } from "react-router-dom";

import { SEOHead } from "../components/SEOHead/SEOHead";

export function AdminNotFoundPage() {
  return (
    <>
      <SEOHead title="Not found" noindex />
      <h1>Page not found</h1>
      <p>
        <Link to="/admin">Back to the dashboard</Link>
      </p>
    </>
  );
}
