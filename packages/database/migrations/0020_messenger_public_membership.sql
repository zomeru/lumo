-- Public channels follow workspace membership. Preserve existing roles, cursors and preferences.
INSERT INTO conversation_members (workspace_id, conversation_id, user_id, role)
SELECT c.workspace_id, c.id, m.user_id, 'member'
FROM conversations c
JOIN workspace_members m ON m.workspace_id = c.workspace_id
WHERE c.kind = 'channel' AND c.visibility = 'public' AND c.retired_at IS NULL
ON CONFLICT (conversation_id, user_id) DO NOTHING;
--> statement-breakpoint
-- Covers invitation acceptance, public joining and any other workspace enrollment path.
CREATE FUNCTION enroll_messenger_public_channels() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- Serialize against channel creation without conflicting with the FK's KEY SHARE lock.
  PERFORM 1 FROM workspaces WHERE id = NEW.workspace_id FOR NO KEY UPDATE;
  INSERT INTO conversation_members (workspace_id, conversation_id, user_id, role)
  SELECT c.workspace_id, c.id, NEW.user_id, 'member'
  FROM conversations c
  WHERE c.workspace_id = NEW.workspace_id AND c.kind = 'channel'
    AND c.visibility = 'public' AND c.retired_at IS NULL
  ON CONFLICT (conversation_id, user_id) DO NOTHING;
  PERFORM pg_notify('lumolynk_messenger', NEW.workspace_id::text);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER messenger_workspace_enrollment AFTER INSERT ON workspace_members
FOR EACH ROW EXECUTE FUNCTION enroll_messenger_public_channels();
