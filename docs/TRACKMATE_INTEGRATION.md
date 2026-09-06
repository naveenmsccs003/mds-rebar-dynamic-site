# Trackmate Integration (Future)

## Boundary
```
MDS Website/CMS -> Integration API/Service -> MDS Trackmate
```
The CMS database and Trackmate's internal database are never directly
coupled. All data exchange goes through a dedicated integration
boundary — a `integration`/Trackmate client module — so either system's
internals can change independently.

## Components (built when integration is actually scoped, not before)
- Trackmate API client (isolated module, not scattered across CMS apps).
- Authentication adapter + request signing.
- Timeout, retry-with-backoff, and circuit-breaker handling so a
  Trackmate outage degrades gracefully instead of cascading into the
  public website.
- Webhook receiver (if Trackmate pushes events) with signature
  verification.
- Integration event log (what was sent/received, when, result) separate
  from the general `AuditLog` but following the same append-only
  principle.

## Potential data surfaces
Contract drawings, approved placing drawings, bar lists, quantity
details, RFIs, CORs, logs, document history, dashboards, MIS reports,
project tasks/status.

## Status
Not implemented in the current phase plan (Phases 1–16 cover the public
website + CMS + admin platform). This document defines the boundary so
that when Trackmate integration is scoped, it plugs into an isolated
service layer rather than requiring changes throughout the CMS codebase.
