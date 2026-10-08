CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id TEXT PRIMARY KEY NOT NULL,
  attempts INTEGER NOT NULL,
  expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_login_attempts_expires ON admin_login_attempts(expires);
