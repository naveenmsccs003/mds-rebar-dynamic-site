# File Storage

## Flow
```
Browser -> Backend authorization check -> Presigned upload URL
        -> Object Storage -> Background processing (Celery)
        -> Database metadata record
```
The backend never proxies large file bytes through the Django process
where a presigned/direct upload is feasible; it issues a scoped,
time-limited upload URL after validating the request (auth, allowed
content type, size ceiling), then processes/validates the result
asynchronously.

## Storage abstraction
A thin `StorageBackend` interface (backed by Django's `Storage` API)
isolates the concrete provider (AWS S3, Azure Blob, GCS, or any
S3-compatible service) behind configuration, so switching providers later
does not touch application code. Public buckets/prefixes serve
CDN-cached published assets (images used on public pages); a separate
private bucket/prefix holds anything requiring authorization.

**Implemented (Phase 10):** `apps.documents.storage` — `get_storage()`
returns the backend named by `DOCUMENT_STORAGE_BACKEND`.
`LocalSignedStorage` (dev/test) stores bytes through
`STORAGES["default"]` and mints `django.core.signing` tokens verified by
the `/api/v1/files/{u,d}/{token}/` transfer views — standing in for an
object store's presigned PUT / GET. `S3SignedStorage` (production) uses
`django-storages` + boto3 presigned URLs; its imports are lazy so the
dependency is only needed where it is selected. `private/…` and
`public/…` key prefixes replace separate buckets in the local backend;
visibility + signed access are what actually gate a private file.

## Metadata (PostgreSQL) vs. bytes (object storage)
The DB never stores file bytes — only: object key (randomized, not the
original filename), original filename (metadata only), owner, content
type, size, checksum, visibility, processing status, created date.

## Validation (server-side, always)
Size limit per file type, extension allow-list, actual MIME/content
sniffing (not the browser-reported type), filename sanitization before
generating the randomized object key, and a hook point for malware
scanning before a file is marked usable.

## Private file access
Never a predictable path like `/files/123/resume.pdf`. Access requires:
1. Authentication + authorization check against the requesting user's
   permissions/ownership.
2. A short-lived signed URL issued only after that check passes.
3. A `DownloadLog` entry (who, when, IP/user-agent) written on issuance.

**Implemented (Phase 10):** `apps.documents.services.issue_download` —
`can_download(user, document)` (public → open; private → owner or
`documents.view_document`), then a `DownloadLog` row + a
`document.downloaded` audit row, then a `DOCUMENT_DOWNLOAD_URL_TTL`
(default 5 min) signed URL. `GET /api/v1/documents/{uuid}/download/` is
the generic entry; `resources/{slug}/download/` and
`admin/career-applications/{id}/resume/` are the caller-authorized
variants (they pass `skip_authz=True` after their own check but still
log). A `pending` document returns `409 NOT_READY`.

## Resume handling (career applications)
Same rules as any private file, plus: private storage only, randomized
filename, no execution of uploaded content, and a defined path to attach
malware scanning before HR ever opens the file.

**Phase 8 (implemented, interim):** `POST /api/v1/career-applications/`
accepts the file directly as multipart (there is no object-storage
backend to presign against yet). `apps.applications.uploads`:
`validate_resume()` — size ceiling, extension allow-list
(`pdf`/`doc`/`docx`), leading-byte content sniff; `store_resume()` —
SHA-256 checksum, random-UUID object key under
`RESUME_UPLOAD_STORAGE_PREFIX` (`private/resumes/`), a `Document` row
with `visibility=private`, `status=pending`, and `owner=None`;
`scan_hook(document)` is the no-op the Phase 10 async malware scan
replaces (it flips `status` to `processed` / `failed`). The admin API
exposes `resume_status` but never a download link — the authorized
signed-URL path is Phase 10, and a `pending` document must not be
downloadable.

## Restricted resources
Resource records with `access_type=restricted` resolve to a signed URL
generated per request rather than a static download link; download
counts are incremented via the same authorized path, not by trusting a
client-reported event.
