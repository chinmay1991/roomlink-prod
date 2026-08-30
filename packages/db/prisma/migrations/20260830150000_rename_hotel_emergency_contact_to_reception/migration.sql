-- "Emergency Contact" was renamed to "Reception Contact" (same field, same
-- guest-facing purpose — a rename, not a new concept), so the column is
-- renamed in place to preserve existing values instead of adding a new one.
ALTER TABLE "hotels" RENAME COLUMN "emergency_contact" TO "reception_contact";
