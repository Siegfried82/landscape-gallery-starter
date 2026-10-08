CREATE TABLE admin_sessions (id TEXT PRIMARY KEY NOT NULL, expires INTEGER NOT NULL);
CREATE INDEX admin_sessions_expires ON admin_sessions(expires);
