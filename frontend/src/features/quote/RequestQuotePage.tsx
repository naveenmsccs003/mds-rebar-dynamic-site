/**
 * Request-a-quote form (spec §17). Posts to `/api/v1/quote-requests/`;
 * the backend generates a public reference (MDS-Q-YYYY-NNNNNN), emails an
 * acknowledgement, and alerts sales. The service list is the published
 * catalogue; country selection waits for the markets API (a later
 * phase) — the backend field is optional.
 */
import { useState } from "react";

import { Button } from "../../components/Button/Button";
import { Container } from "../../components/Container/Container";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { useServices } from "../services/hooks";
import { type FieldErrors, fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { useQuoteSubmit } from "./hooks";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function RequestQuotePage() {
  const mutation = useQuoteSubmit();
  const services = useServices();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [service, setService] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [projectSize, setProjectSize] = useState("");
  const [timeline, setTimeline] = useState("");
  const [message, setMessage] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const serverErrors = fieldErrorsFromApi(mutation.error);
  const formError = formErrorFromApi(mutation.error);
  const err = (f: string) => errors[f] ?? serverErrors[f];

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (honeypot) return;
    const found: FieldErrors = {};
    if (!name.trim()) found.name = "Enter your name.";
    if (!EMAIL_RE.test(email)) found.email = "Enter a valid email address.";
    setErrors(found);
    if (Object.keys(found).length === 0) {
      mutation.mutate({
        name,
        company,
        email,
        phone,
        service: service || null,
        project_type: projectType,
        project_location: projectLocation,
        project_size: projectSize,
        timeline,
        message,
      });
    }
  }

  return (
    <>
      <SEOHead
        title="Request a Quote"
        description="Tell us about your project and we'll send a tailored quote."
        canonicalPath="/request-quote"
      />
      <Container as="header" className="page-header">
        <h1 className="page-header__title">Request a Quote</h1>
      </Container>

      <Section containerSize="narrow" ariaLabel="Quote request form">
        {mutation.isSuccess ? (
          <div className="form__success" role="status">
            <h3>Quote request received</h3>
            <p>
              Thanks — our team will review your project and respond soon.
              {mutation.data.reference && (
                <>
                  {" "}
                  Your reference is <strong>{mutation.data.reference}</strong>; please quote it in
                  any follow-up.
                </>
              )}
            </p>
          </div>
        ) : (
          <form className="form" onSubmit={onSubmit} noValidate>
            {formError && (
              <p className="form__error form__error--top" role="alert">
                {formError}
              </p>
            )}

            <label className="form__field">
              <span>Full name</span>
              <input
                type="text"
                value={name}
                autoComplete="name"
                aria-invalid={err("name") ? true : undefined}
                onChange={(e) => setName(e.target.value)}
              />
              {err("name") && <span className="form__error">{err("name")}</span>}
            </label>

            <label className="form__field">
              <span>Company (optional)</span>
              <input
                type="text"
                value={company}
                autoComplete="organization"
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>

            <label className="form__field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                autoComplete="email"
                aria-invalid={err("email") ? true : undefined}
                onChange={(e) => setEmail(e.target.value)}
              />
              {err("email") && <span className="form__error">{err("email")}</span>}
            </label>

            <label className="form__field">
              <span>Phone (optional)</span>
              <input
                type="tel"
                value={phone}
                autoComplete="tel"
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>

            <label className="form__field">
              <span>Service (optional)</span>
              <select value={service} onChange={(e) => setService(e.target.value)}>
                <option value="">— Select a service —</option>
                {(services.data ?? []).map((s) => (
                  <option key={s.id} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
              {err("service") && <span className="form__error">{err("service")}</span>}
            </label>

            <label className="form__field">
              <span>Project type (optional)</span>
              <input
                type="text"
                value={projectType}
                placeholder="e.g. Commercial tower, bridge"
                onChange={(e) => setProjectType(e.target.value)}
              />
            </label>

            <label className="form__field">
              <span>Project location (optional)</span>
              <input
                type="text"
                value={projectLocation}
                onChange={(e) => setProjectLocation(e.target.value)}
              />
            </label>

            <label className="form__field">
              <span>Project size (optional)</span>
              <input
                type="text"
                value={projectSize}
                placeholder="e.g. tonnage, floor area"
                onChange={(e) => setProjectSize(e.target.value)}
              />
            </label>

            <label className="form__field">
              <span>Timeline (optional)</span>
              <input
                type="text"
                value={timeline}
                placeholder="e.g. start Q3, 6-month build"
                onChange={(e) => setTimeline(e.target.value)}
              />
            </label>

            <label className="form__field">
              <span>Anything else (optional)</span>
              <textarea
                value={message}
                rows={5}
                maxLength={5000}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>

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

            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Submitting…" : "Request quote"}
            </Button>
          </form>
        )}
      </Section>
    </>
  );
}
