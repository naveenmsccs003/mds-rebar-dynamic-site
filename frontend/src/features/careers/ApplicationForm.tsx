/**
 * Job application form (spec §16). Client-side validation is a courtesy
 * only — the server re-checks everything, including the résumé's real
 * content type and size (docs/SECURITY.md "File uploads"). A hidden
 * honeypot field (`website`) catches naive bots; the backend silently
 * accepts and discards those.
 */
import { useId, useState } from "react";

import { Button } from "../../components/Button/Button";
import { type FieldErrors, fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";

import { useApplicationSubmit } from "./hooks";

const ACCEPTED_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.join(",");
const MAX_BYTES = 5 * 1024 * 1024;

function validate(form: { name: string; email: string; resume: File | null }): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim()) errors.name = "Enter your name.";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) errors.email = "Enter a valid email address.";
  if (!form.resume) {
    errors.resume = "Attach your résumé.";
  } else {
    const name = form.resume.name.toLowerCase();
    if (!ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      errors.resume = "Résumé must be a PDF or Word document.";
    } else if (form.resume.size > MAX_BYTES) {
      errors.resume = "Résumé must be 5 MB or smaller.";
    }
  }
  return errors;
}

export function ApplicationForm({ jobSlug, disabled }: { jobSlug: string; disabled?: boolean }) {
  const uid = useId();
  const mutation = useApplicationSubmit();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  if (mutation.isSuccess) {
    const ref = mutation.data.reference;
    return (
      <div className="form__success" role="status">
        <h3>Application received</h3>
        <p>
          Thank you for applying. Our team will be in touch if your experience matches the role.
          {ref && (
            <>
              {" "}
              Your reference is <strong>{ref}</strong>.
            </>
          )}
        </p>
      </div>
    );
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (honeypot) return; // bot — mimic the backend and do nothing visible
    const found = validate({ name, email, resume });
    setErrors(found);
    if (Object.keys(found).length > 0 || !resume) return;
    mutation.mutate({ job: jobSlug, name, email, phone, cover_letter: coverLetter, resume });
  }

  const serverErrors: FieldErrors = fieldErrorsFromApi(mutation.error);
  const formError = formErrorFromApi(mutation.error);
  const err = (field: string) => errors[field] ?? serverErrors[field];

  return (
    <form className="form" onSubmit={onSubmit} noValidate aria-labelledby={`${uid}-heading`}>
      <h2 id={`${uid}-heading`} className="cms-section__heading">
        Apply for this role
      </h2>

      {formError && (
        <p className="form__error form__error--top" role="alert">
          {formError}
        </p>
      )}

      <label className="form__field">
        <span>Full name</span>
        <input
          type="text"
          name="name"
          value={name}
          autoComplete="name"
          required
          aria-invalid={err("name") ? true : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        {err("name") && <span className="form__error">{err("name")}</span>}
      </label>

      <label className="form__field">
        <span>Email</span>
        <input
          type="email"
          name="email"
          value={email}
          autoComplete="email"
          required
          aria-invalid={err("email") ? true : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        {err("email") && <span className="form__error">{err("email")}</span>}
      </label>

      <label className="form__field">
        <span>Phone (optional)</span>
        <input
          type="tel"
          name="phone"
          value={phone}
          autoComplete="tel"
          onChange={(e) => setPhone(e.target.value)}
        />
      </label>

      <label className="form__field">
        <span>Résumé (PDF or Word, max 5 MB)</span>
        <input
          type="file"
          name="resume"
          accept={ACCEPT_ATTR}
          required
          aria-invalid={err("resume") ? true : undefined}
          onChange={(e) => setResume(e.target.files?.[0] ?? null)}
        />
        {err("resume") && <span className="form__error">{err("resume")}</span>}
      </label>

      <label className="form__field">
        <span>Cover letter (optional)</span>
        <textarea
          name="cover_letter"
          value={coverLetter}
          rows={5}
          maxLength={5000}
          onChange={(e) => setCoverLetter(e.target.value)}
        />
      </label>

      {/* Honeypot: hidden from people, tempting to bots. */}
      <div className="form__honeypot" aria-hidden="true">
        <label>
          Website
          <input
            type="text"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>
      </div>

      <Button type="submit" disabled={disabled || mutation.isPending}>
        {mutation.isPending ? "Submitting…" : "Submit application"}
      </Button>
    </form>
  );
}
