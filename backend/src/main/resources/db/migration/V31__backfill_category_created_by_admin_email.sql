-- One-time backfill: seed categories created before created_by_admin_email was stored correctly.
UPDATE categories
SET created_by_admin_email = (
    SELECT email FROM admin_users WHERE role = 'super_admin' ORDER BY email LIMIT 1
)
WHERE created_by_admin_email IS NULL
  AND slug IN ('body', 'brakes', 'electrical', 'engine', 'filters');
