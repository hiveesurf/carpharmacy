-- Custom roles with page-level permissions (additive; sales/delivery unchanged).
-- Sentinel system role: 'custom' — permissions come from custom_role_id.

-- ---------------------------------------------------------------------------
-- 1) custom_roles
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  name_key    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  TEXT,
  CONSTRAINT custom_roles_name_nonempty CHECK (length(trim(name)) > 0),
  CONSTRAINT custom_roles_name_key_nonempty CHECK (length(trim(name_key)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_roles_name_key
  ON custom_roles (name_key);

CREATE UNIQUE INDEX IF NOT EXISTS uq_custom_roles_name_ci
  ON custom_roles (lower(trim(name)));

-- ---------------------------------------------------------------------------
-- 2) custom_role_permissions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_role_permissions (
  role_id   UUID NOT NULL REFERENCES custom_roles (id) ON DELETE CASCADE,
  page_key  TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, page_key),
  CONSTRAINT custom_role_permissions_page_key_check CHECK (
    page_key IN (
      'analytics',
      'inventory',
      'cars',
      'categories',
      'users',
      'employees',
      'orders'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_custom_role_permissions_page_key
  ON custom_role_permissions (page_key);

-- ---------------------------------------------------------------------------
-- 3) Link employees to a custom role (NULL for sales/delivery/super_admin)
-- ---------------------------------------------------------------------------
ALTER TABLE admin_users
  ADD COLUMN IF NOT EXISTS custom_role_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_users_custom_role_id_fkey'
  ) THEN
    ALTER TABLE admin_users
      ADD CONSTRAINT admin_users_custom_role_id_fkey
      FOREIGN KEY (custom_role_id)
      REFERENCES custom_roles (id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_users_custom_role_id
  ON admin_users (custom_role_id)
  WHERE custom_role_id IS NOT NULL;

-- role='custom' requires a custom_role_id; other roles must not have one
ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_custom_role_consistency;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_custom_role_consistency CHECK (
    (role = 'custom' AND custom_role_id IS NOT NULL)
    OR (role <> 'custom' AND custom_role_id IS NULL)
  );

-- ---------------------------------------------------------------------------
-- 4) Expand role CHECKs with sentinel 'custom'
-- ---------------------------------------------------------------------------
ALTER TABLE admin_users
  DROP CONSTRAINT IF EXISTS admin_users_role_check;

ALTER TABLE admin_users
  ADD CONSTRAINT admin_users_role_check
  CHECK (role IN ('super_admin', 'sales', 'delivery', 'custom'));

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_role_check;

ALTER TABLE users
  ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'super_admin', 'sales', 'delivery', 'custom'));
