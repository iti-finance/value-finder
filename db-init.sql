-- PostgreSQL schema for Value Finder
-- Run this file against the value_finder database.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE profiles (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code varchar(50) NOT NULL UNIQUE,
  full_name varchar(120) NOT NULL,
  email varchar(255),
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_profiles_employee_code_lower ON profiles (lower(employee_code));
CREATE UNIQUE INDEX idx_profiles_email_lower ON profiles (lower(email)) WHERE email IS NOT NULL;

CREATE TABLE user_roles (
  user_id uuid PRIMARY KEY REFERENCES profiles(user_id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'branch'))
);

CREATE TABLE vehicle_values (
  id bigserial PRIMARY KEY,
  make text NOT NULL,
  model text NOT NULL,
  variant text NOT NULL,
  year integer NOT NULL,
  value numeric(12,2) NOT NULL,
  UNIQUE (make, model, variant, year)
);

CREATE TABLE upload_history (
  id bigserial PRIMARY KEY,
  uploaded_by uuid REFERENCES profiles(user_id),
  filename varchar(255) NOT NULL,
  record_count integer NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(user_id),
  employee_code varchar(50),
  action text NOT NULL,
  user_agent text,
  ip text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE password_reset_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code varchar(50) NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(user_id)
);

CREATE INDEX idx_password_reset_requests_employee_code ON password_reset_requests (lower(employee_code));
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
