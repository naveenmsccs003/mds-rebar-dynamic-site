/**
 * Staff sign-in (docs/RBAC_DESIGN.md). Session-cookie auth: on success
 * the session query is populated and we redirect to `?next=` (or the
 * dashboard). The backend throttles + progressively locks out on repeated
 * failures — those come back as a typed `ApiRequestError`.
 */
import { useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";

import { ApiRequestError } from "../../api/request";
import { Button } from "../../components/Button/Button";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { useLogin, useSession } from "./hooks";

export function LoginPage() {
  const { data: session, isPending } = useSession();
  const [params] = useSearchParams();
  const login = useLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const next = params.get("next") ? decodeURIComponent(params.get("next")!) : "/admin";
  if (!isPending && session) return <Navigate to={next} replace />;

  const fieldErr = fieldErrorsFromApi(login.error);
  const formErr =
    formErrorFromApi(login.error) ??
    (login.error instanceof ApiRequestError && Object.keys(login.error.fields).length === 0
      ? login.error.message
      : undefined);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    login.mutate({ email, password });
  }

  return (
    <div className="admin-login">
      <SEOHead title="Staff sign in" noindex />
      <form className="form" onSubmit={onSubmit} aria-labelledby="login-heading">
        <h1 id="login-heading">MDS Rebar — staff</h1>
        {formErr && (
          <p className="form__error form__error--top" role="alert">
            {formErr}
          </p>
        )}
        <label className="form__field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            autoFocus
            value={email}
            aria-invalid={fieldErr.email ? true : undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
          {fieldErr.email && <span className="form__error">{fieldErr.email}</span>}
        </label>
        <label className="form__field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            aria-invalid={fieldErr.password ? true : undefined}
            onChange={(e) => setPassword(e.target.value)}
          />
          {fieldErr.password && <span className="form__error">{fieldErr.password}</span>}
        </label>
        <Button type="submit" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
