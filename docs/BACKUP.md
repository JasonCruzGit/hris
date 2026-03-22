# Backup & recovery

## PostgreSQL

- **Logical dump (recommended before upgrades):**  
  `pg_dump "$DATABASE_URL" -Fc -f hris_backup.dump`
- **Restore:**  
  `pg_restore -d "$DATABASE_URL" --clean hris_backup.dump`

Schedule nightly dumps via `cron` or your cloud provider’s automated backups.

## Uploaded files

Employee documents and public applications store files under the backend `uploads/` directory (or the path configured for Multer). Include this directory in filesystem backups or replicate to object storage (S3-compatible).

## Application secrets

Back up environment files or secret manager entries (`JWT_SECRET`, `DATABASE_URL`, `SMTP_*`, `ATTENDANCE_API_TOKEN` if used) separately from the database; never commit them to git.

## Recovery drill

Periodically restore a dump to a staging database and verify `npx prisma migrate deploy` plus a smoke test (`GET /api/health`, login) succeed.
