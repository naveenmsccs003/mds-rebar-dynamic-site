import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { Container } from "../../components/Container/Container";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useSession } from "./hooks";
import { usePermissionChecker } from "./usePermission";

function Loading() {
  return (
    <Container>
      <div role="status" aria-live="polite" style={{ paddingBlock: "var(--space-6)" }}>
        <span className="sr-only">Checking your session…</span>
        <Skeleton lines={6} />
      </div>
    </Container>
  );
}

/** Gate a subtree on being signed in; bounce to /admin/login otherwise. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: session, isPending, isError, refetch } = useSession();
  const location = useLocation();

  if (isPending) return <Loading />;
  if (isError) {
    return (
      <Container>
        <div className="admin-error" role="alert">
          <p>Couldn’t reach the server.</p>
          <button className="button button--secondary" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </Container>
    );
  }
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

/** Render `children` only if the session holds every codename in `perms`. */
export function RequirePermission({
  perms,
  children,
}: {
  perms: string | string[];
  children: ReactNode;
}) {
  const can = usePermissionChecker();
  if (!can(perms)) {
    return (
      <Container>
        <div className="admin-error" role="alert">
          <h1>Not permitted</h1>
          <p>Your role doesn’t include access to this section.</p>
        </div>
      </Container>
    );
  }
  return <>{children}</>;
}
