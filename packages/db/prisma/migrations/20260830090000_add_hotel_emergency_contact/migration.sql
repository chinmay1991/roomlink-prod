-- Guest-facing emergency contact number, printed on room QR cards. Separate
-- from the existing general `phone` field (front-desk contact) — collected
-- once at hotel onboarding.
ALTER TABLE "hotels" ADD COLUMN "emergency_contact" VARCHAR(20);
