# Data Persistence for Vercel/Render Deployment

**Purpose:** Document how to ensure `portal_store.json` mutations survive Render redeploys.

## Current State

- **Backend:** Flask on Render (Docker)
- **Storage:** `backend/data/portal_store.json` - file-based
- **Risk:** On Render, Docker filesystem is ephemeral unless using [Render Persistent Disks](https://render.com/docs/disks)

## Recommendation

Enable Render Persistent Disk for `backend/data/` so portal mutations (reserves, allocations, adjustments, etc.) survive redeploys.

### Steps (Render Dashboard)

1. Go to your Render service (canoil-portal-backend)
2. Settings → Disks → Add Disk
3. Mount path: `/app/backend/data` (or wherever `portal_store.json` is written)
4. Size: 1 GB is sufficient for JSON store

### Alternative: PostgreSQL

Migrate `portal_store` data to PostgreSQL (schema exists in `db/01_schema.sql`). See [GAP_ANALYSIS_MISYS_REPLACEMENT.md](../Markdown File Types/GAP_ANALYSIS_MISYS_REPLACEMENT.md).
