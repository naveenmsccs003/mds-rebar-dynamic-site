import { Link } from "react-router-dom";

import { Container } from "../components/Container/Container";
import { SEOHead } from "../components/SEOHead/SEOHead";

export function NotFoundPage() {
  return (
    <Container className="not-found">
      <SEOHead title="Page not found" noindex />
      <h1>Page not found</h1>
      <p>The page you're looking for doesn't exist or has moved.</p>
      <p>
        <Link to="/" className="button button--primary">
          Back to home
        </Link>
      </p>
    </Container>
  );
}
