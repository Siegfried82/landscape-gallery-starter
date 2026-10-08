CREATE TABLE admin_audit_events (
 id TEXT PRIMARY KEY NOT NULL,
 created INTEGER NOT NULL,
 method TEXT NOT NULL,
 path TEXT NOT NULL,
 status INTEGER NOT NULL
);
CREATE INDEX admin_audit_events_created ON admin_audit_events(created);
