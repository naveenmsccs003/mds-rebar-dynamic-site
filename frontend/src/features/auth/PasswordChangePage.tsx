import { useState } from "react";

import { Button } from "../../components/Button/Button";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { usePasswordChange } from "./hooks";

export function PasswordChangePage() {
  const mutation = usePasswordChange();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const fieldErr = fieldErrorsFromApi(mutation.error);
  const formErr = formErrorFromApi(mutation.error);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutation.mutate(
      { current, next },
      { onSuccess: () => { setCurrent(""); setNext(""); } },
    );
  }

  return (
    <>
      <SEOHead title="Change password" noindex />
      <h1>Change password</h1>
      {mutation.isSuccess && (
        <p className="form__success" role="status">
          Password updated.
        </p>
      )}
      <form className="form" onSubmit={onSubmit}>
        {formErr && (
          <p className="form__error form__error--top" role="alert">
            {formErr}
          </p>
        )}
        <label className="form__field">
          <span>Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={current}
            aria-invalid={fieldErr.current_password ? true : undefined}
            onChange={(e) => setCurrent(e.target.value)}
          />
          {fieldErr.current_password && <span className="form__error">{fieldErr.current_password}</span>}
        </label>
        <label className="form__field">
          <span>New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={next}
            aria-invalid={fieldErr.new_password ? true : undefined}
            onChange={(e) => setNext(e.target.value)}
          />
          {fieldErr.new_password && <span className="form__error">{fieldErr.new_password}</span>}
        </label>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : "Update password"}
        </Button>
      </form>
    </>
  );
}
