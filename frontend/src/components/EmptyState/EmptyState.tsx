export function EmptyState({
  title = "Nothing to show yet",
  description,
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="state state--empty" role="status">
      <p className="state__title">{title}</p>
      {description && <p className="state__description">{description}</p>}
    </div>
  );
}
