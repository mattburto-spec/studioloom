-- Migration 081: Unit Auto-Version Trigger
-- Part of Dimensions3 Phase 7A — Integrity & Versioning (§8.1)
-- Auto-snapshots the OLD content_data into unit_versions on every UPDATE
-- that actually changes content_data. Metadata-only updates are skipped.

CREATE OR REPLACE FUNCTION snapshot_unit_version() RETURNS TRIGGER AS $$
BEGIN
  -- Only version when content_data actually changes
  IF OLD.content_data IS DISTINCT FROM NEW.content_data THEN
    INSERT INTO unit_versions (unit_id, version_number, content_data)
    VALUES (
      OLD.id,
      COALESCE(
        (SELECT MAX(version_number) FROM unit_versions WHERE unit_id = OLD.id),
        0
      ) + 1,
      OLD.content_data
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_units_version
  BEFORE UPDATE ON units
  FOR EACH ROW EXECUTE FUNCTION snapshot_unit_version();
