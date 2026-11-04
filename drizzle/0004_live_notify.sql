-- Live updates: every change to client-visible data sends NOTIFY portal_changes '<agency_id>:<client_id>'.
-- The app LISTENs once (src/lib/live) and pushes a "changed" event to open pages over SSE.
-- Postgres folds identical notifications inside one transaction, so a bulk sync sends one.

CREATE OR REPLACE FUNCTION portal_notify_row() RETURNS trigger AS $$
DECLARE
  r jsonb := to_jsonb(COALESCE(NEW, OLD));
  agency text;
  client text;
BEGIN
  IF TG_TABLE_NAME = 'request_comments' THEN
    SELECT agency_id::text, client_id::text INTO agency, client FROM requests WHERE id = (r->>'request_id')::uuid;
  ELSIF TG_TABLE_NAME = 'keyword_ranks' THEN
    SELECT agency_id::text, client_id::text INTO agency, client FROM keywords WHERE id = (r->>'keyword_id')::uuid;
  ELSIF TG_TABLE_NAME = 'ai_answers' THEN
    SELECT agency_id::text, client_id::text INTO agency, client FROM ai_questions WHERE id = (r->>'question_id')::uuid;
  ELSE
    agency := r->>'agency_id';
    client := r->>'client_id';
  END IF;
  IF agency IS NOT NULL THEN
    PERFORM pg_notify('portal_changes', agency || ':' || COALESCE(client, ''));
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['requests','request_comments','messages','files','invoices','monthly_notes','work_log',
                           'action_items','site_stats','keywords','keyword_ranks','ai_questions','ai_answers','users']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS portal_notify ON %I', t);
    EXECUTE format('CREATE TRIGGER portal_notify AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION portal_notify_row()', t);
  END LOOP;
END $$;
