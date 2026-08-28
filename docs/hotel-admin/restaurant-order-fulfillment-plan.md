# Restaurant order fulfillment — kitchen & delivery plan

Status: **proposal, not yet built.** Written against the current codebase (`apps/guest`,
`apps/hotel-admin`, `packages/db/prisma/schema.prisma`) and the existing planning docs that already
flagged this as a gap: `docs/guest/guest-implementation-plan.md` §11, `docs/hotel-admin/reception-
implementation-plan.md` §E.2, and `docs/hotel-admin/department-manager-plan.md` §5 all independently
deferred "Restaurant/Kitchen staff order-management" to "a future Restaurant-staff module" — this is
that module.

## 1. Current gap

Today: a guest can browse the menu, cart, and place an order (`POST /api/guest/orders`), and can see
its status. Reception can *view* all hotel orders, read-only, by explicit design (PRD §24: "do NOT
build restaurant POS functionality" for Reception — Reception monitors, never manages). **Nothing
anywhere moves an order's status forward.** `order_status` starts at `pending` and stays there
forever — no route, service function, or screen (guest, Reception, Manager, or Staff) ever writes to
it. The `orders` table also has no concept of dine-in vs. room delivery — every order implicitly
assumes room delivery (`room_id` is the only location field).

Separately, the generic `requests` engine (Accept → Start → Complete, built for Housekeeping/
Maintenance) already has a "Restaurant" department seeded and a Department Staff role that can work
tasks in it — but that engine works `requests` rows (ad-hoc quick-request types), not real
cart-based `orders`/`order_items` rows. It's a parallel mechanism, not a substitute for order
fulfillment.

## 2. Goals

1. Guest chooses **room delivery** or **dine-in at the restaurant** when placing an order.
2. Restaurant department staff get a live kitchen queue and can move an order through prep to
   completion, claiming it the same race-safe way Staff already claims `requests`.
3. Guest sees live status, including the dine-in/delivery distinction, on the existing order
   tracking screens.
4. Reception's existing read-only order view keeps working unchanged — it finally shows real,
   moving statuses instead of everything permanently stuck at `pending`.

## 3. Explicit non-goals (V1, matching the PRD's "no full restaurant POS" rule)

- **Payment/billing.** `orders.total_amount` stays informational, as already decided. The natural
  next step — posting a delivered order to the guest's folio via the already-modeled but unused
  `invoices`/`payments` tables — is a separate future phase, not part of this plan.
- **Walk-in (non-resident) restaurant guests / table QR codes.** `qr_codes.room_id` is a required
  (non-nullable) FK to `rooms` — there's no concept of a table-scoped QR or a session for someone
  without an active room stay. Dine-in here means *a guest who already has an active room session*
  chooses to eat at the restaurant instead of having food sent to their room, and optionally leaves a
  table number. True walk-in restaurant ordering is out of scope, same tier as "full restaurant POS"
  in the PRD's V1 non-goals list.
- Table reservations, split bills, kitchen printer/KDS hardware integration, delivery-runner
  location tracking.
- Push notifications / websockets — this app has deliberately never introduced that infra (PRD §27
  allows "minimum reliable polling"); this plan follows the same convention.

## 4. End-to-end flow

### Ordering (guest side)

1. Guest browses `/menu`, adds items to cart — unchanged (`cart-context.tsx`, `localStorage`).
2. **New**: at `/cart` checkout, guest picks a fulfillment mode:
   - **Deliver to my room** (default — pre-filled from the active session's room, no extra input).
   - **I'll eat at the restaurant** — optional free-text table number (guest may not know it yet;
     staff can note it after seating).
3. `POST /api/guest/orders` extended to accept `orderType: 'room_delivery' | 'dine_in'` and an
   optional `tableNumber`. Server-side item/price re-validation is unchanged — client-sent prices are
   still never trusted. Order is created at `status: pending`.
4. Guest tracks it on `/orders` / `/orders/[orderId]`, which already polls; status labels extend to
   cover the new states (§6).

### Kitchen intake & prep (Restaurant department staff)

5. **New** `/hotel/staff/orders` Kitchen Board, staff-facing, visually modeled on the existing
   `StaffTaskList` card pattern — scoped to the staff member's departments (must include
   "Restaurant"), same as `requests` scoping already works. Polls every ~10–15s (a bit tighter than
   the 20s used elsewhere, since food timing matters more — still plain polling, not new infra).
6. **Accept** — `POST /api/v1/hotel/orders/[orderId]/accept`, a conditional `updateMany` exactly like
   `acceptRequest`'s claim mechanic (`WHERE status = 'pending'` in the same statement, so two staff
   clicking Accept at once can't both win). Status → `accepted`.
7. **Start Preparing** → status `preparing`.
8. Fork by `order_type`:
   - **`room_delivery`**: **Out for Delivery** → status `out_for_delivery`, then **Delivered**
     (staff confirms hand-off) → status `delivered`, sets `delivered_at`.
   - **`dine_in`**: no delivery leg — **Served** goes straight `preparing → delivered`, with the
     guest- and staff-facing label rendered as "Served" instead of "Delivered" when
     `order_type === 'dine_in'` (reuses the terminal state rather than adding a `served` enum value —
     see §6 for why).
9. **Cancel** is only reachable from `pending`/`accepted` — once food is in `preparing`, kitchen
   can't cancel it away, mirroring how `REQUEST_TRANSITIONS` locks out cancellation from active work.

### Back to the guest

10. The guest's order detail and the existing "computed feed" notification derivation (already
    produces messages like *"Your restaurant order is Preparing"*) extend to cover `accepted` and the
    dine-in-aware terminal label.

### Reception (unchanged)

11. Reception's existing `/hotel/reception-desk/orders` page needs no new write capability — it was
    already correctly scoped to read-only per PRD §24. It simply starts showing real status
    transitions instead of everything sitting at `pending` forever.

## 5. Data model changes

`orders` (`packages/db/prisma/schema.prisma`):

| Column | Type | Notes |
|---|---|---|
| `order_type` | new enum `order_fulfillment_type` (`room_delivery`, `dine_in`) | `@default(room_delivery)` — every existing row backfills correctly with no ambiguity. |
| `table_number` | `String? @db.VarChar(20)` | Only meaningful when `order_type = dine_in`; not validated against a real `tables` table (none exists) — free text, matching V1's lightweight-menu precedent. |
| `accepted_at` | `DateTime? @db.Timestamptz(6)` | Mirrors `delivered_at`'s pattern; lets the kitchen board show elapsed-since-accepted, same idea as `sla.ts`'s use of `created_at`. |

`order_status` enum gains one value:

```
pending → accepted → preparing → out_for_delivery → delivered
                                          (dine_in skips this step)
                    ↘ cancelled (from pending/accepted only)
```

**Why add `accepted` now, when the guest module explicitly chose not to:** that decision
(`guest-implementation-plan.md` §4.5) was correct *at the time* — "nothing in this codebase
transitions an order's status at all yet," so adding a state nothing could move into was purely
speculative. That condition no longer holds once this module exists: PRD §17 already specifies
`NEW → ACCEPTED → PREPARING → OUT_FOR_DELIVERY → DELIVERED`, and `request_status` set the direct
precedent for extending an enum exactly when the transition logic that uses it gets built
(`department-manager-plan.md` §6, Phase A). Reusing `delivered` as dine-in's terminal state (rather
than adding `served`) keeps the enum from growing for a distinction that's purely cosmetic — a label
decision, not a state-machine one, same principle the guest module already applied when it collapsed
`escalated` into `in_progress` for display purposes only (§4.4).

New table `order_status_history`, a direct structural copy of the existing `request_status_history`:

| Column | Notes |
|---|---|
| `order_id`, `from_status`, `to_status`, `changed_by`, `note?`, `changed_at` | Same shape as `request_status_history`; gives the kitchen board and Reception's view an audit trail, and gives staff accountability parity with how `requests` already work. |

Migration also needs `hotel_admin`'s Prisma client (`@roomlink/db`) regenerated for the new
`order_fulfillment_type` enum and `orders.order_type`/`table_number`/`accepted_at` fields.

## 6. State machine

New `apps/hotel-admin/src/server/transitions.ts` export, following the exact shape of
`REQUEST_TRANSITIONS`:

```ts
export const ORDER_TRANSITIONS: Record<order_status, order_status[]> = {
  pending: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['out_for_delivery', 'delivered'], // dine_in orders go straight to delivered
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
}
```

Route-level validation additionally checks `order_type` before allowing `preparing → out_for_delivery`
(only valid for `room_delivery`) — `canTransition` alone can't express that constraint, so it's an
explicit guard in the service function, same place `acceptRequest` already does its own extra checks
beyond the pure transition table.

## 7. API surface (`apps/hotel-admin`)

| Endpoint | Action | RBAC |
|---|---|---|
| `POST /api/v1/hotel/orders/[orderId]/accept` | Claim a pending order (race-safe conditional update) | `hotel_orders` / `edit` |
| `POST /api/v1/hotel/orders/[orderId]/status` | Move to the next status (`{ status, note? }`), validated via `ORDER_TRANSITIONS` | `hotel_orders` / `edit` |
| `GET /api/v1/hotel/orders` (existing) | List — Reception sees all; Staff sees only their departments' orders, mirroring `listRequests`'s scoping | `hotel_orders` / `view` |
| `GET /api/v1/hotel/orders/[orderId]` (existing) | Detail | `hotel_orders` / `view` |
| `GET /api/v1/hotel/orders/[orderId]/history` | Status history (new, mirrors `.../requests/[id]/history`) | `hotel_orders` / `view` |

Guest side: `POST /api/guest/orders` gains `orderType`/`tableNumber` in `createOrderSchema`; no new
route needed.

## 8. RBAC changes

`hotel_orders` already exists as a module (`apps/hotel-admin/src/lib/permissions.ts`) and Reception
already has `{ view: true }` on it — **that grant is intentionally left unchanged**, preserving the
existing "Reception never manages POS" boundary. What's missing is any grant at all for the two roles
that actually need to work orders:

```ts
// apps/hotel-admin/src/server/services/hotel-roles.service.ts — DEFAULT_GRANTS
'Department Manager': {
  ...,
  hotel_orders: { view: true, edit: true },   // new
},
'Department Staff': {
  ...,
  hotel_orders: { view: true, edit: true },   // new
},
```

Department-scoping (only Restaurant-department staff can act on Restaurant orders) happens in the
service layer via `user_departments`, exactly the same pattern `listRequests`/`acceptRequest` already
use for `requests` — no new authorization primitive needed.

## 9. Real-time / notifications

No websockets/SSE, consistent with the rest of the app. Kitchen board polls faster (10–15s) than
Reception's 20s `PollingRefresh`, since a stale kitchen queue costs more than a stale dashboard.

**Optional, low-effort nice-to-have** (not built unless requested): a client-side "new order" chime —
compare the polled order list to the previous poll's ids and play a short `Audio()` beep on a newly
appeared `pending` order. This is plain client-side diffing, not real infrastructure, so it doesn't
conflict with the "no unnecessary infra complexity" rule — distinct from the dedicated
WebRTC/ZegoCloud signaling built for voice calls, which is unnecessary here.

## 10. Known limitations / explicit follow-ups

- **Dine-in requires an existing room-based session.** There's no ordering path for someone without
  an active `guest_sessions` row — see §3.
- **No payment or room-charge step.** An order reaching `delivered` doesn't touch `invoices`/
  `payments` at all yet.
- **One staff pool does everything.** Whoever accepts an order can take it all the way through
  delivery/serving — there's no separate "runner" vs. "cook" role split in V1, matching the existing
  precedent of a single Department Staff member (e.g. the seeded "Raju") working a department
  end-to-end.

## 11. Build order

1. Migration: `order_fulfillment_type` enum, `orders.order_type`/`table_number`/`accepted_at`,
   `order_status` gains `accepted`, new `order_status_history` table.
2. `ORDER_TRANSITIONS` in `transitions.ts` (+ its own `*.test.ts`, same pattern as
   `transitions.test.ts`).
3. `apps/hotel-admin/src/server/services/orders.service.ts`: extend with `acceptOrder`,
   `updateOrderStatus`, `getOrderHistory`, and a staff-scoped `listStaffOrders` (department-filtered,
   mirrors `listRequests`'s staff branch).
4. Routes: `accept`, `status`, `history` under `/api/v1/hotel/orders/[orderId]/`.
5. RBAC grants (§8).
6. Kitchen Board UI: `/hotel/staff/orders`, `StaffBottomNav`/`Sidebar` entry for Staff/Manager roles.
7. Guest checkout: fulfillment-type picker + table-number field on `/cart`; `order.schema.ts` and
   `apps/guest/src/server/services/orders.service.ts` updated to accept and persist them.
8. Guest order tracking: extend `GUEST_ORDER_STATUS_LABEL` (`apps/guest/src/lib/guest-status.ts`) for
   `accepted` and the dine-in "Served" label.
9. Reception's existing orders page: no functional change — just verify the new statuses render
   correctly through the existing `StatusBadge`.
10. Tests: pure `ORDER_TRANSITIONS` unit tests; service-level tests for accept race-safety and
    department scoping, mirroring `requests.service.test.ts`'s existing coverage.
