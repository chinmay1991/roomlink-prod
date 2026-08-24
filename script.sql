-- =====================================================================
-- RoomLink — Digital Intercom & Guest Service Platform
-- PostgreSQL Database Schema
-- Covers: Super Admin (platform), Hotel Admin (property ops),
--         Front Office, Guest experience, Billing, Support, Audit
-- Version: 1.0
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUM TYPES
-- ---------------------------------------------------------------------
CREATE TYPE hotel_status        AS ENUM ('pending', 'onboarding', 'trial', 'active', 'suspended', 'churned');
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'paused', 'cancelled', 'expired');
CREATE TYPE billing_cycle       AS ENUM ('monthly', 'yearly');
CREATE TYPE user_status         AS ENUM ('active', 'invited', 'suspended', 'disabled');
CREATE TYPE user_type           AS ENUM ('super_admin', 'support_staff', 'hotel_admin', 'hotel_staff');
CREATE TYPE room_status         AS ENUM ('active', 'inactive', 'maintenance');
CREATE TYPE request_status      AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE order_status        AS ENUM ('pending', 'preparing', 'out_for_delivery', 'delivered', 'cancelled');
CREATE TYPE menu_item_status    AS ENUM ('active', 'inactive');
CREATE TYPE service_status      AS ENUM ('active', 'inactive');
CREATE TYPE onboarding_step_status AS ENUM ('pending', 'in_progress', 'complete');
CREATE TYPE ticket_status       AS ENUM ('open', 'assigned', 'in_progress', 'waiting_for_hotel', 'resolved', 'closed');
CREATE TYPE invoice_status      AS ENUM ('draft', 'sent', 'paid', 'overdue', 'refunded', 'cancelled');
CREATE TYPE payment_status      AS ENUM ('pending', 'success', 'failed', 'refunded');
CREATE TYPE conversation_status AS ENUM ('open', 'closed');
CREATE TYPE sender_type         AS ENUM ('guest', 'staff', 'system');
CREATE TYPE integration_type    AS ENUM ('pms', 'payment_gateway', 'communication');
CREATE TYPE actor_type          AS ENUM ('super_admin', 'hotel_admin', 'hotel_staff', 'system');


-- =====================================================================
-- SECTION 1: PLATFORM CORE (Super Admin domain)
-- =====================================================================

-- Subscription plans (Starter / Professional / Enterprise / Custom)
CREATE TABLE subscription_plans (
    plan_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    is_custom       BOOLEAN NOT NULL DEFAULT FALSE,
    room_limit      INTEGER,                       -- NULL = unlimited
    staff_limit     INTEGER,
    price_amount    NUMERIC(12,2) NOT NULL,
    price_currency  VARCHAR(3) NOT NULL DEFAULT 'INR',
    billing_cycle   billing_cycle NOT NULL DEFAULT 'monthly',
    features        JSONB NOT NULL DEFAULT '{}',   -- feature flags per plan
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hotels (tenant workspaces)
CREATE TABLE hotels (
    hotel_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    hotel_code      VARCHAR(50) UNIQUE NOT NULL,
    brand           VARCHAR(100),
    address_line    VARCHAR(255),
    city            VARCHAR(100),
    state           VARCHAR(100),
    country         VARCHAR(100),
    pincode         VARCHAR(20),
    contact_person  VARCHAR(150),
    phone           VARCHAR(20),
    email           VARCHAR(150),
    logo_url        VARCHAR(500),
    time_zone       VARCHAR(60) NOT NULL DEFAULT 'Asia/Kolkata',
    check_in_time   TIME NOT NULL DEFAULT '14:00',
    check_out_time  TIME NOT NULL DEFAULT '11:00',
    status          hotel_status NOT NULL DEFAULT 'pending',
    plan_id         UUID REFERENCES subscription_plans(plan_id),
    implementation_owner_id UUID,                  -- FK to users, added after users table
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hotel subscriptions (a hotel's active/historical subscription records)
CREATE TABLE subscriptions (
    subscription_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    plan_id         UUID NOT NULL REFERENCES subscription_plans(plan_id),
    status          subscription_status NOT NULL DEFAULT 'trial',
    start_date      DATE NOT NULL,
    end_date        DATE,
    trial_end_date  DATE,
    auto_renew      BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_hotel ON subscriptions(hotel_id);


-- =====================================================================
-- SECTION 2: USERS, ROLES & PERMISSIONS
-- =====================================================================

CREATE TABLE roles (
    role_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(hotel_id) ON DELETE CASCADE, -- NULL = platform-level system role
    name            VARCHAR(100) NOT NULL,          -- e.g. Super Admin, Hotel Admin, Front Office Staff, Housekeeping Supervisor
    is_system_role  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, name)
);

CREATE TABLE permissions (
    permission_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module          VARCHAR(100) NOT NULL,          -- Chats, Voice Calls, Requests, Orders, Announcements, Guests, Billing...
    UNIQUE (module)
);

CREATE TABLE role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id   UUID NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    can_view        BOOLEAN NOT NULL DEFAULT FALSE,
    can_create      BOOLEAN NOT NULL DEFAULT FALSE,
    can_edit        BOOLEAN NOT NULL DEFAULT FALSE,
    can_delete      BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (role_id, permission_id)
);

-- Departments (per hotel: Front Office (mandatory), Housekeeping, Maintenance, Restaurant, Spa, Transport, custom)
CREATE TABLE departments (
    department_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    is_custom       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, name)
);

-- All human users of the platform: Super Admin / Support Staff / Hotel Admin / Hotel Staff
-- Note: department is NOT stored here — a staff member can be linked to zero, one, or
-- several departments via the user_departments join table below (see Section 2a).
CREATE TABLE users (
    user_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(hotel_id) ON DELETE CASCADE,  -- NULL for platform-level (Super Admin/Support)
    role_id         UUID NOT NULL REFERENCES roles(role_id),
    user_type       user_type NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) UNIQUE NOT NULL,
    phone           VARCHAR(20),
    password_hash   VARCHAR(255) NOT NULL,
    status          user_status NOT NULL DEFAULT 'invited',
    mfa_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    invited_by      UUID REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_hotel ON users(hotel_id);
CREATE INDEX idx_users_role ON users(role_id);

ALTER TABLE hotels
    ADD CONSTRAINT fk_hotels_implementation_owner
    FOREIGN KEY (implementation_owner_id) REFERENCES users(user_id);

-- ---------------------------------------------------------------------
-- SECTION 2a: STAFF <-> DEPARTMENT ASSIGNMENT (many-to-many, optional)
-- ---------------------------------------------------------------------
-- A staff member may be unassigned to any department (e.g. a Hotel Admin
-- with no operational department), or assigned to several at once
-- (e.g. a staff member handling both Housekeeping and Maintenance tasks).
CREATE TABLE user_departments (
    user_id         UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    department_id   UUID NOT NULL REFERENCES departments(department_id) ON DELETE CASCADE,
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,   -- optional: mark one as the staff member's main department
    assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, department_id)
);

CREATE INDEX idx_user_departments_user ON user_departments(user_id);
CREATE INDEX idx_user_departments_department ON user_departments(department_id);


-- =====================================================================
-- SECTION 3: ROOMS, QR CODES, GUESTS
-- =====================================================================

CREATE TABLE room_types (
    room_type_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,          -- Standard, Deluxe, Suite, Family Room...
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, name)
);

CREATE TABLE rooms (
    room_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    room_type_id    UUID REFERENCES room_types(room_type_id),
    room_number      VARCHAR(20) NOT NULL,
    floor           VARCHAR(20),
    status          room_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, room_number)
);

CREATE INDEX idx_rooms_hotel ON rooms(hotel_id);

CREATE TABLE qr_codes (
    qr_code_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID NOT NULL REFERENCES rooms(room_id) ON DELETE CASCADE,
    code_value      VARCHAR(255) NOT NULL UNIQUE,    -- encoded value / URL the QR points to
    image_url       VARCHAR(500),
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    generated_by    UUID REFERENCES users(user_id),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE
);

-- Guests are lightweight — created on QR scan / check-in, no login required
CREATE TABLE guests (
    guest_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    room_id         UUID REFERENCES rooms(room_id),
    full_name       VARCHAR(150),
    phone           VARCHAR(20),
    email           VARCHAR(150),
    check_in_date   TIMESTAMPTZ,
    check_out_date  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_guests_hotel_room ON guests(hotel_id, room_id);


-- =====================================================================
-- SECTION 4: CHAT / VOICE / REQUESTS (Guest <-> Staff)
-- =====================================================================

CREATE TABLE conversations (
    conversation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    room_id         UUID REFERENCES rooms(room_id),
    guest_id        UUID REFERENCES guests(guest_id),
    assigned_staff_id UUID REFERENCES users(user_id),
    status          conversation_status NOT NULL DEFAULT 'open',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at       TIMESTAMPTZ
);

CREATE TABLE messages (
    message_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(conversation_id) ON DELETE CASCADE,
    sender_type     sender_type NOT NULL,
    sender_id       UUID,                            -- guest_id or user_id depending on sender_type
    content         TEXT NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- Service requests (housekeeping, maintenance, front-desk, etc.)
CREATE TABLE requests (
    request_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    room_id         UUID REFERENCES rooms(room_id),
    guest_id        UUID REFERENCES guests(guest_id),
    department_id   UUID REFERENCES departments(department_id),
    request_type    VARCHAR(150) NOT NULL,           -- Extra Towels, AC Not Cooling, Room Cleaning...
    status          request_status NOT NULL DEFAULT 'pending',
    assigned_to     UUID REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_requests_hotel_status ON requests(hotel_id, status);

-- Quick service catalogue (buttons shown to guest — Extra Towels, Toiletries, Laundry Pickup...)
CREATE TABLE services (
    service_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    department_id   UUID REFERENCES departments(department_id),
    name            VARCHAR(150) NOT NULL,
    description     TEXT,
    status          service_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================================
-- SECTION 5: RESTAURANT MENU & ORDERS
-- =====================================================================

CREATE TABLE menu_categories (
    category_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,           -- Breakfast, Lunch, Dinner, Snacks, Beverages, Desserts
    display_order   INTEGER NOT NULL DEFAULT 0,
    UNIQUE (hotel_id, name)
);

CREATE TABLE menu_items (
    item_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    category_id     UUID NOT NULL REFERENCES menu_categories(category_id) ON DELETE CASCADE,
    name            VARCHAR(150) NOT NULL,
    price           NUMERIC(10,2) NOT NULL,
    image_url       VARCHAR(500),
    status          menu_item_status NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_menu_items_hotel_category ON menu_items(hotel_id, category_id);

CREATE TABLE orders (
    order_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    room_id         UUID REFERENCES rooms(room_id),
    guest_id        UUID REFERENCES guests(guest_id),
    status          order_status NOT NULL DEFAULT 'pending',
    total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    delivered_at    TIMESTAMPTZ
);

CREATE TABLE order_items (
    order_item_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    item_id         UUID NOT NULL REFERENCES menu_items(item_id),
    quantity        INTEGER NOT NULL DEFAULT 1,
    unit_price      NUMERIC(10,2) NOT NULL
);

CREATE INDEX idx_order_items_order ON order_items(order_id);


-- =====================================================================
-- SECTION 6: ONBOARDING TRACKER (Super Admin visibility)
-- =====================================================================

CREATE TABLE onboarding_tracker (
    tracker_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    step_name       VARCHAR(100) NOT NULL,           -- Hotel Profile, Departments, Rooms, QR Generation, Staff Setup, Menu, Services, Testing, Go Live
    step_order      INTEGER NOT NULL,
    status          onboarding_step_status NOT NULL DEFAULT 'pending',
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (hotel_id, step_name)
);


-- =====================================================================
-- SECTION 7: SUPPORT CENTER
-- =====================================================================

CREATE TABLE support_tickets (
    ticket_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    raised_by       UUID REFERENCES users(user_id),
    category        VARCHAR(100) NOT NULL,           -- Login, QR Code, Room Setup, Menu Upload, Billing, PMS Integration...
    subject         VARCHAR(255) NOT NULL,
    description     TEXT,
    status          ticket_status NOT NULL DEFAULT 'open',
    assigned_to     UUID REFERENCES users(user_id),  -- Super Admin / support staff
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at     TIMESTAMPTZ
);

CREATE TABLE ticket_messages (
    ticket_message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES support_tickets(ticket_id) ON DELETE CASCADE,
    sender_id       UUID REFERENCES users(user_id),
    content         TEXT NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================================
-- SECTION 8: BILLING & PAYMENTS
-- =====================================================================

CREATE TABLE invoices (
    invoice_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    subscription_id UUID REFERENCES subscriptions(subscription_id),
    invoice_number  VARCHAR(50) UNIQUE NOT NULL,
    amount          NUMERIC(12,2) NOT NULL,
    currency        VARCHAR(3) NOT NULL DEFAULT 'INR',
    status          invoice_status NOT NULL DEFAULT 'draft',
    due_date        DATE,
    paid_date       DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payments (
    payment_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id      UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    amount          NUMERIC(12,2) NOT NULL,
    method          VARCHAR(50),                     -- card, upi, netbanking...
    gateway         VARCHAR(50),                      -- Razorpay, Stripe
    gateway_txn_id  VARCHAR(150),
    status          payment_status NOT NULL DEFAULT 'pending',
    paid_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invoices_hotel ON invoices(hotel_id);
CREATE INDEX idx_payments_invoice ON payments(invoice_id);


-- =====================================================================
-- SECTION 9: INTEGRATIONS
-- =====================================================================

CREATE TABLE integrations (
    integration_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID REFERENCES hotels(hotel_id) ON DELETE CASCADE,  -- NULL = platform-level default config
    integration_type integration_type NOT NULL,
    provider        VARCHAR(100) NOT NULL,           -- Oracle OPERA, IDS Next, eZee, Hotelogix, Razorpay, Stripe, WhatsApp, Twilio...
    config           JSONB NOT NULL DEFAULT '{}',     -- API keys / secrets should be stored in a secrets manager, not here
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================================
-- SECTION 10: ANNOUNCEMENTS
-- =====================================================================

CREATE TABLE announcements (
    announcement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id        UUID NOT NULL REFERENCES hotels(hotel_id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    content         TEXT NOT NULL,
    created_by      UUID REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- =====================================================================
-- SECTION 11: IMPERSONATION SESSIONS (Super Admin -> Hotel workspace)
-- =====================================================================

CREATE TABLE impersonation_sessions (
    session_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    super_admin_id   UUID NOT NULL REFERENCES users(user_id),
    hotel_id         UUID NOT NULL REFERENCES hotels(hotel_id),
    hotel_admin_id   UUID REFERENCES users(user_id),
    started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at         TIMESTAMPTZ,
    hotel_notified   BOOLEAN NOT NULL DEFAULT FALSE
);


-- =====================================================================
-- SECTION 12: AUDIT LOGS
-- =====================================================================

CREATE TABLE audit_logs (
    log_id          BIGSERIAL PRIMARY KEY,
    actor_id        UUID,                            -- user_id of actor (nullable for system actions)
    actor_type      actor_type NOT NULL,
    action          VARCHAR(150) NOT NULL,            -- e.g. 'hotel.created', 'subscription.changed', 'user.invited'
    entity_type     VARCHAR(100) NOT NULL,            -- e.g. 'hotel', 'subscription', 'user', 'invoice'
    entity_id       UUID,
    before_state    JSONB,
    after_state     JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);


-- =====================================================================
-- SECTION 13: HELPFUL VIEWS (optional, for dashboards)
-- =====================================================================

-- Platform KPI snapshot for Super Admin dashboard
CREATE VIEW v_platform_kpis AS
SELECT
    (SELECT COUNT(*) FROM hotels) AS total_hotels,
    (SELECT COUNT(*) FROM hotels WHERE status = 'active') AS active_hotels,
    (SELECT COUNT(*) FROM hotels WHERE status = 'trial') AS trial_hotels,
    (SELECT COUNT(*) FROM hotels WHERE status = 'onboarding') AS onboarding_hotels,
    (SELECT COUNT(*) FROM rooms) AS total_rooms,
    (SELECT COUNT(*) FROM support_tickets WHERE status NOT IN ('resolved','closed')) AS open_support_tickets,
    (SELECT COUNT(*) FROM payments WHERE status = 'failed') AS failed_payments;

-- Hotel onboarding completion percentage
CREATE VIEW v_hotel_onboarding_progress AS
SELECT
    hotel_id,
    COUNT(*) FILTER (WHERE status = 'complete')::NUMERIC / COUNT(*)::NUMERIC * 100 AS percent_complete
FROM onboarding_tracker
GROUP BY hotel_id;
