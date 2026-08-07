-- Allow pending workforce availability for employees not yet logged in

ALTER TABLE admin_users
DROP CONSTRAINT IF EXISTS admin_users_availability_check;

ALTER TABLE admin_users
ADD CONSTRAINT admin_users_availability_check
CHECK (availability_status IN ('online', 'busy', 'offline', 'pending'));
