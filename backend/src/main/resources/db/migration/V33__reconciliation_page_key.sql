-- Add reconciliation admin page key for custom role permissions.
ALTER TABLE custom_role_permissions
  DROP CONSTRAINT IF EXISTS custom_role_permissions_page_key_check;

ALTER TABLE custom_role_permissions
  ADD CONSTRAINT custom_role_permissions_page_key_check CHECK (
    page_key IN (
      'analytics',
      'inventory',
      'cars',
      'categories',
      'users',
      'employees',
      'orders',
      'sales_report',
      'reconciliation'
    )
  );
