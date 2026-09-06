/**
 * Create / edit a CMS `PageSection`. `content` is free-form structured
 * JSON (the section component decides its shape) — edited here as
 * pretty-printed JSON and parsed on submit; the server sanitises any
 * `*_html` values. When editing, the workflow bar + version history are
 * shown alongside.
 */
import { useState } from "react";

import { ApiRequestError } from "../../api/request";
import { Button } from "../../components/Button/Button";
import { TextField } from "../../components/admin/FormField";
import { VersionHistoryPanel } from "../../components/admin/VersionHistoryPanel";
import { WorkflowBar } from "../../components/admin/WorkflowBar";
import { fieldErrorsFromApi, formErrorFromApi } from "../shared/publicForm";
import { usePermissionChecker } from "../auth/usePermission";
import {
  useSectionCreate,
  useSectionRollback,
  useSectionTransition,
  useSectionUpdate,
  useSectionVersions,
} from "./hooks";
import type { PageSectionRow } from "./types";

interface Props {
  section: PageSectionRow | null; // null = create
  onSaved: () => void;
}

export function SectionForm({ section, onSaved }: Props) {
  const editing = section !== null;
  const create = useSectionCreate();
  const update = useSectionUpdate();
  const transition = useSectionTransition();
  const rollback = useSectionRollback();
  const versions = useSectionVersions(editing ? section.id : null);
  const can = usePermissionChecker();

  const [pageKey, setPageKey] = useState(section?.page_key ?? "");
  const [sectionKey, setSectionKey] = useState(section?.section_key ?? "");
  const [order, setOrder] = useState(String(section?.display_order ?? 0));
  const [contentText, setContentText] = useState(
    JSON.stringify(section?.content ?? {}, null, 2),
  );
  const [jsonError, setJsonError] = useState<string | undefined>();

  const mutation = editing ? update : create;
  const fieldErr = fieldErrorsFromApi(mutation.error);
  const formErr = formErrorFromApi(mutation.error) ?? jsonError;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    let content: Record<string, unknown>;
    try {
      content = JSON.parse(contentText || "{}");
      setJsonError(undefined);
    } catch {
      setJsonError("Content is not valid JSON.");
      return;
    }
    const body = {
      page_key: pageKey,
      section_key: sectionKey,
      display_order: Number(order) || 0,
      content,
    };
    if (editing) {
      update.mutate({ id: section.id, body }, { onSuccess: onSaved });
    } else {
      create.mutate(body, { onSuccess: onSaved });
    }
  }

  return (
    <div className="admin-form-stack">
      <form className="form" onSubmit={submit}>
        {formErr && (
          <p className="form__error form__error--top" role="alert">
            {formErr}
          </p>
        )}
        <TextField
          label="Page key"
          value={pageKey}
          error={fieldErr.page_key}
          onChange={(e) => setPageKey(e.target.value)}
        />
        <TextField
          label="Section key"
          value={sectionKey}
          error={fieldErr.section_key}
          onChange={(e) => setSectionKey(e.target.value)}
        />
        <TextField
          label="Display order"
          type="number"
          value={order}
          error={fieldErr.display_order}
          onChange={(e) => setOrder(e.target.value)}
        />
        <label className="form__field">
          <span>Content (JSON)</span>
          <textarea
            className="admin-code"
            rows={12}
            value={contentText}
            aria-invalid={jsonError ? true : undefined}
            onChange={(e) => setContentText(e.target.value)}
          />
          {(jsonError || fieldErr.content) && (
            <span className="form__error">{jsonError ?? fieldErr.content}</span>
          )}
        </label>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Saving…" : editing ? "Save changes" : "Create section"}
        </Button>
      </form>

      {editing && (
        <>
          <section aria-label="Publishing workflow" className="admin-panel">
            <h3>Workflow</h3>
            <WorkflowBar
              status={section.status}
              allowedTransitions={section.allowed_transitions}
              permBase="pages.pagesection"
              busy={transition.isPending}
              onTransition={(to, note) =>
                transition.mutate({ id: section.id, to, note }, { onSuccess: onSaved })
              }
            />
            {transition.error instanceof ApiRequestError && (
              <p className="form__error" role="alert">
                {transition.error.message}
              </p>
            )}
          </section>

          <section aria-label="Version history" className="admin-panel">
            <h3>Version history</h3>
            <VersionHistoryPanel
              query={versions}
              canRollback={can("pages.change_pagesection")}
              rollingBackId={rollback.isPending ? rollback.variables?.versionId ?? null : null}
              onRollback={(versionId) =>
                rollback.mutate({ id: section.id, versionId }, { onSuccess: onSaved })
              }
            />
          </section>
        </>
      )}
    </div>
  );
}
