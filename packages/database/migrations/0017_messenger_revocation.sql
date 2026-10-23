-- Existing and new membership removal paths invalidate every API instance after commit.
-- Payload is only the workspace ID; no private conversation metadata is published.
CREATE FUNCTION notify_messenger_membership() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('lumolynk_messenger', OLD.workspace_id::text);
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER messenger_workspace_revocation AFTER DELETE OR UPDATE ON workspace_members
FOR EACH ROW EXECUTE FUNCTION notify_messenger_membership();
