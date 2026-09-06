/**
 * Public service catalogue — one card per published service (spec §10:
 * one reusable list + one reusable detail template render every service).
 */
import { Card } from "../../components/Card/Card";
import { Container } from "../../components/Container/Container";
import { EmptyState } from "../../components/EmptyState/EmptyState";
import { PageState } from "../../components/PageState/PageState";
import { SEOHead } from "../../components/SEOHead/SEOHead";
import { Section } from "../../components/Section/Section";
import { Skeleton } from "../../components/Skeleton/Skeleton";
import { useServices } from "./hooks";

export function ServiceListPage() {
  const query = useServices();

  return (
    <>
      <SEOHead
        title="Services"
        description="MDS Rebar's engineering services — rebar detailing, estimation, BIM coordination and more."
        canonicalPath="/services"
      />
      <Container as="header" className="page-header">
        <h1 className="page-header__title">Services</h1>
      </Container>

      <PageState
        query={query}
        isEmpty={(services) => services.length === 0}
        loadingState={
          <Container>
            <div role="status" aria-live="polite">
              <span className="sr-only">Loading services…</span>
              <Skeleton lines={5} />
            </div>
          </Container>
        }
        emptyState={
          <Container>
            <EmptyState
              title="No services published yet"
              description="[CONTENT PLACEHOLDER — ADMIN TO COMPLETE]"
            />
          </Container>
        }
      >
        {(services) => (
          <Section>
            <ul className="cms-card-grid">
              {services.map((s) => (
                <li key={s.id}>
                  <Card title={s.name} to={`/services/${s.slug}`}>
                    {s.short_description && <p>{s.short_description}</p>}
                  </Card>
                </li>
              ))}
            </ul>
          </Section>
        )}
      </PageState>
    </>
  );
}
