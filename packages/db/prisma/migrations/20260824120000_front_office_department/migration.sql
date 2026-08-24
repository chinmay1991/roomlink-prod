-- Reception stops being a separate role/user-type carve-out and becomes a normal,
-- mandatory hotel department ("Front Office"), using the existing
-- departments/user_departments/roles/permissions architecture. No new tables.
--
-- Safe on live data: renames preserve department_id/role_id/user_id, so every
-- existing FK (role_permissions, audit_logs.actor_id, requests.department_id,
-- etc.) keeps pointing at the same row. Historical audit_logs rows keep their
-- original 'reception.*' action strings — see docs/hotel-admin/*, §15 of the
-- Front Office architecture change: don't rewrite history, just stop writing
-- new records that way.

-- AlterTable
ALTER TABLE "departments" ADD COLUMN "is_mandatory" BOOLEAN NOT NULL DEFAULT false;

-- Rename any existing "Reception" department template rows to "Front Office"
-- and lock them as mandatory. (Most hotels never enabled this optional
-- template, so this affects a small subset.)
UPDATE "departments"
SET "name" = 'Front Office', "is_mandatory" = true, "is_enabled" = true
WHERE "name" = 'Reception';

-- Every hotel must have a Front Office department, whether or not it ever
-- touched the old "Reception" template.
INSERT INTO "departments" ("department_id", "hotel_id", "name", "is_custom", "is_enabled", "is_mandatory", "created_at")
SELECT gen_random_uuid(), h."hotel_id", 'Front Office', false, true, true, now()
FROM "hotels" h
WHERE NOT EXISTS (
  SELECT 1 FROM "departments" d WHERE d."hotel_id" = h."hotel_id" AND d."name" = 'Front Office'
);

-- The old hardcoded "Reception" role becomes "Front Office Staff" — the
-- app's role model now also has an optional "Front Office Manager" tier
-- (seeded lazily by hotel-roles.service.ts, same as every other department),
-- but no hotel had a manager concept for Reception before, so every existing
-- Reception user maps to the Staff tier, not Manager.
UPDATE "roles"
SET "name" = 'Front Office Staff'
WHERE "name" = 'Reception';

-- Reception users previously had zero department memberships (the special-
-- cased role bypassed user_departments entirely). Backfill membership in the
-- hotel's own Front Office department so they're visible/assignable the same
-- way every other department's staff already are.
INSERT INTO "user_departments" ("user_id", "department_id", "is_primary", "assigned_at")
SELECT u."user_id", d."department_id", true, now()
FROM "users" u
JOIN "roles" r ON r."role_id" = u."role_id" AND r."name" = 'Front Office Staff'
JOIN "departments" d ON d."hotel_id" = u."hotel_id" AND d."name" = 'Front Office'
ON CONFLICT ("user_id", "department_id") DO NOTHING;
