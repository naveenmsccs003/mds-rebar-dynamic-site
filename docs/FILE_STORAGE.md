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

## Resume handling (career applications)
Same rules as any private file, plus: private storage only, randomized
filename, no execution of uploaded content, and a defined path to attach
malware scanning before HR ever opens the file.

## Restricted resources
Resource records with `access_type=restricted` resolve to a signed URL
generated per request rather than a static download link; download
counts are incremented via the same authorized path, not by trusting a
client-reported event.
