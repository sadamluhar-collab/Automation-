# Artifacts

Artifacts are tenant-scoped, project-backed output records. Each artifact has a storage bucket/path, checksum, byte size, status and current version. Every registered artifact creates version 1 in `artifact_versions`; later versions update the current artifact pointer and append immutable version history.

API:
- `GET /api/artifacts`
- `GET /api/artifacts/:id`
- `POST /api/artifacts`
- `POST /api/artifacts/:id/versions`
- `POST /api/artifacts/:id/status`

The API validates project and tenant ownership before reading or mutating an artifact.