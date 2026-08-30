-- Guest-facing room service contact number, printed on room QR cards below
-- the emergency contact. Collected at hotel onboarding alongside
-- emergency_contact, and editable later from the hotel-admin Profile page.
ALTER TABLE "hotels" ADD COLUMN "room_service_contact" VARCHAR(20);
