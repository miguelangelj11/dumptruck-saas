-- Team invite migration
-- Run before deploying the invite/accept flow.
-- Safe to re-run (all statements use IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'dispatcher',
  token       uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by  uuid,
  accepted_at timestamptz,
  expires_at  timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  role        text NOT NULL DEFAULT 'dispatcher',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_invitations_token    ON invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_company  ON invitations (company_id);
CREATE INDEX IF NOT EXISTS idx_team_members_company ON team_members (company_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user    ON team_members (user_id);

ALTER TABLE invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
-- All access goes through admin-client API routes; no browser-direct RLS policies needed.
