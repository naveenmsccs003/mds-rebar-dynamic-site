/**
 * Field-by-field before/after view of one audit entry. Keys from both
 * snapshots are listed once; changed rows are marked so a reviewer can
 * see what moved without reading two JSON blobs side by side.
 */
function show(value: unknown): string {
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

export function AuditDiff({
  before,
  after,
}: {
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}) {
  const keys = [...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})])].sort();
  if (keys.length === 0) return <p className="admin-muted">No field snapshot was recorded for this action.</p>;

  return (
    <table className="audit-diff">
      <thead>
        <tr>
          <th scope="col">Field</th>
          <th scope="col">Before</th>
          <th scope="col">After</th>
        </tr>
      </thead>
      <tbody>
        {keys.map((k) => {
          const b = show(before?.[k]);
          const a = show(after?.[k]);
          const changed = b !== a;
          return (
            <tr key={k} className={changed ? "audit-diff__row--changed" : undefined}>
              <th scope="row">
                {k}
                {changed && <span className="sr-only"> (changed)</span>}
              </th>
              <td>{b || <span className="admin-muted">—</span>}</td>
              <td>{a || <span className="admin-muted">—</span>}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
