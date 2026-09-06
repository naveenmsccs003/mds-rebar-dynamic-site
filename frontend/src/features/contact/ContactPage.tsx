/**
 * Contact form (spec §18). Posts to `/api/v1/contact/`; the backend
 * validates, coalesces double-submits, emails an acknowledgement with a
 * reference number, and alerts the sales inbox. Client-side checks are a
 * courtesy — the server re-checks everything.
 */
import { useState } from "react";

import { Button } from "../../components/Button/Button";
import { Container } from "../../components/Container/Container";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { type FieldErrors, fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { useEnquirySubmit } from "./hooks";
import type { EnquiryType } from "./types";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function ContactPage() {
  const mutation = useEnquirySubmit();
  const [enquiryType, setEnquiryType] = useState<EnquiryType>("contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
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
    if (!message.trim()) found.message = "Enter a message.";
    setErrors(found);
    if (Object.keys(found).length === 0) {
      mutation.mutate({ enquiry_type: enquiryType, name, email, phone, company, message });
    }
  }

  return (
    <>
      <SEOHead
        title="Contact"
        description="Get in touch with MDS Rebar — general enquiries and business development."
        canonicalPath="/contact"
      />
      <Container as="header" className="page-header">
        <h1 className="page-header__title">Contact</h1>
      </Container>

      <Section containerSize="narrow" ariaLabel="Contact form">
        {mutation.isSuccess ? (
          <div className="form__success" role="status">
            <h3>Message received</h3>
            <p>
              Thanks for getting in touch — we&rsquo;ll reply soon.
              {mutation.data.reference && (
                <>
                  {" "}
                  Your reference is <strong>{mutation.data.reference}</strong>.
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

            <fieldset className="form__field">
              <legend>What is this about?</legend>
              <label>
                <input
                  type="radio"
                  name="enquiry_type"
                  checked={enquiryType === "contact"}
                  onChange={() => setEnquiryType("contact")}
                />{" "}
                General enquiry
              </label>
              <label>
                <input
                  type="radio"
                  name="enquiry_type"
                  checked={enquiryType === "business"}
                  onChange={() => setEnquiryType("business")}
                />{" "}
                Business / partnership
              </label>
            </fieldset>

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
              <span>Company (optional)</span>
              <input
                type="text"
                value={company}
                autoComplete="organization"
                onChange={(e) => setCompany(e.target.value)}
              />
            </label>

            <label className="form__field">
              <span>Message</span>
              <textarea
                value={message}
                rows={6}
                maxLength={5000}
                aria-invalid={err("message") ? true : undefined}
                onChange={(e) => setMessage(e.target.value)}
              />
              {err("message") && <span className="form__error">{err("message")}</span>}
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
              {mutation.isPending ? "Sending…" : "Send message"}
            </Button>
          </form>
        )}
      </Section>
    </>
  );
}
