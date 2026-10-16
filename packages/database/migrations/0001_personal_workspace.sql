-- Custom SQL migration file, put your code below! --
-- User, personal workspace, owner membership and preferences commit together.
CREATE FUNCTION create_personal_workspace() RETURNS trigger AS $$
DECLARE personal_id uuid;
BEGIN
  INSERT INTO workspaces (name, personal_owner_id, visibility)
    VALUES (left(split_part(trim(NEW.name), ' ', 1), 80) || '''s Workspace', NEW.id, 'private')
    RETURNING id INTO personal_id;
  INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (personal_id, NEW.id, 'owner');
  INSERT INTO user_profiles (user_id, active_workspace_id) VALUES (NEW.id, personal_id);
  INSERT INTO audit_events (workspace_id, actor_id, action) VALUES (personal_id, NEW.id, 'workspace.personal.created');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER users_personal_workspace AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_personal_workspace();
--> statement-breakpoint
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));
