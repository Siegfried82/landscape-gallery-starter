CREATE TABLE visitors (
 id INTEGER PRIMARY KEY NOT NULL,
 browser_key TEXT NOT NULL UNIQUE,
 visits INTEGER NOT NULL DEFAULT 1,
 first_seen INTEGER NOT NULL,
 last_seen INTEGER NOT NULL
);
CREATE INDEX visitors_last_seen ON visitors(last_seen);
