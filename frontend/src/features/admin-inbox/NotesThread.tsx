/**
 * The append-only internal note thread on an enquiry
 * (`…/enquiries/{id}/notes/`). Notes come embedded in the enquiry detail
 * payload; adding one needs `contact.change_enquiry`.
 */
import { useState } from "react";

import { ApiRequestError } from "../../api/request";
import { Button } from "../../components/Button/Button";
import { usePermission } from "../auth/usePermission";
import { useAddEnquiryNote } from "./hooks";
import type { EnquiryNote } from "./types";

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export function NotesThread({ enquiryId, notes }: { enquiryId: number; notes: EnquiryNote[] }) {
  const canAdd = usePermission("contact.change_enquiry");
  const add = useAddEnquiryNote();
  const [text, setText] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const note = text.trim();
    if (!note) return;
    add.mutate({ id: enquiryId, note }, { onSuccess: () => setText("") });
  }

  return (
    <>
      {notes.length === 0 ? (
        <p className="admin-muted">No notes yet.</p>
      ) : (
        <ul className="notes-thread">
          {notes.map((n) => (
            <li key={n.id} className="notes-thread__item">
              <p className="notes-thread__meta">
                {when(n.created_at)} · {n.author_email || "system"}
              </p>
              <p className="notes-thread__body">{n.note}</p>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <form className="form" onSubmit={submit}>
          <label className="form__field">
            <span>Add a note</span>
            <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          </label>
          {add.error instanceof ApiRequestError && (
            <p className="form__error" role="alert">
              {add.error.message}
            </p>
          )}
          <Button type="submit" variant="secondary" disabled={add.isPending || !text.trim()}>
            {add.isPending ? "Adding…" : "Add note"}
          </Button>
        </form>
      )}
    </>
  );
}
