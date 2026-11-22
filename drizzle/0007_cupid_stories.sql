CREATE TABLE cupid_stories (
  id text PRIMARY KEY NOT NULL,
  title text NOT NULL,
  story text NOT NULL,
  username text,
  status text NOT NULL DEFAULT 'pending',
  revision integer NOT NULL DEFAULT 1,
  created_at integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX cupid_stories_status_date_idx ON cupid_stories (status, created_at, id);
