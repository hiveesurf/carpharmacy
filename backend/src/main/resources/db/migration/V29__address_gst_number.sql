-- Optional GSTIN on customer addresses (nullable; empty means unset)

ALTER TABLE addresses
  ADD COLUMN IF NOT EXISTS gst_number VARCHAR(15);

COMMENT ON COLUMN addresses.gst_number IS 'Optional Indian GSTIN; null when not provided';
