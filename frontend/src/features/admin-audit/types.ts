/** `apps.audit.serializers.AuditLogSerializer` (docs/SECURITY.md "Audit logging"). */
export interface AuditRow {
  id: number;
  /** e.g. `user.updated`, `service.published`, `auth.login.failed`. */
  action: string;
  /** `app_label.Model`, e.g. `users.User`. */
  entity_type: string;
  entity_id: string;
  /** Null for system-initiated actions (scheduled publishing, …). */
  actor: number | null;
  actor_email: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string;
  timestamp: string;
}
