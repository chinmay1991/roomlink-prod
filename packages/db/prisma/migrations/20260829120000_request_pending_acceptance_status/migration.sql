-- Reception assigning a request to a specific staff member now requires
-- that staff member's acknowledgement: `pending_acceptance` sits between
-- "reception picked someone" and `assigned` ("that person confirmed it").
-- Rejecting an assignment sends the request back to `pending` (unassigned)
-- for reassignment, rather than introducing a separate terminal status.
--
-- Added alone, in its own migration: a new enum value can't be referenced
-- by name in the same transaction that adds it, so no other statement here
-- may use 'pending_acceptance'.
ALTER TYPE "request_status" ADD VALUE 'pending_acceptance';
