import { canManageSettings } from "@lumo/contracts/permissions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Avatar, ErrorMessage, Loading } from "@/components/ui";
import { clearWorkspaceCache, sessionQuery, workspaceQuery, workspacesQuery } from "@/lib/api";

const upcoming = [
  { label: "Communicate", items: ["Messenger", "Meetings"] },
  { label: "Create", items: ["Docs", "Sheets", "Slides", "Drive"] },
  { label: "Work", items: ["Tasks", "Projects"] },
  { label: "People & HR", items: ["Approvals", "Leave", "Attendance", "Hiring"] },
];

export function WorkspaceShell({ workspaceId }: { workspaceId: string }) {
  const ws = useQuery(workspaceQuery(workspaceId));
  const joined = useQuery(workspacesQuery());
  const session = useQuery(sessionQuery());
  const client = useQueryClient();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  async function switchWorkspace(id: string) {
    setSwitching(true);
    setMenuOpen(false);
    setError(null);
    try {
      await clearWorkspaceCache(client);
      await navigate({ to: "/w/$workspaceId", params: { workspaceId: id } });
    } catch (cause) {
      setError(cause instanceof Error ? cause : new Error("Unable to switch workspace."));
    } finally {
      setSwitching(false);
      setMenuOpen(false);
    }
  }
  if (ws.isError)
    return (
      <main id="main-content" className="centered">
        <h1>Workspace unavailable</h1>
        <p>You may no longer be a member of this workspace.</p>
        <ErrorMessage error={ws.error} />
        <Link className="button primary" to="/workspaces">
          Your workspaces
        </Link>
      </main>
    );
  if (!ws.data || !session.data) return <Loading />;
  const workspace = ws.data;
  return (
    <div className="app-shell">
      <button
        className="mobile-menu"
        aria-expanded={menuOpen}
        aria-controls="workspace-navigation"
        disabled={switching}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        {menuOpen ? "Close navigation" : "☰ Navigation"}
      </button>
      <aside id="workspace-navigation" className={menuOpen ? "sidebar open" : "sidebar"}>
        <div className="sidebar-brand">
          <span className="brand-mark" aria-hidden="true">
            L<span />
          </span>
          <div>
            <strong>LUMO</strong>
            <small>Your connected workspace</small>
          </div>
        </div>
        <label className="switcher-label" htmlFor="workspace-switcher">
          Workspace
        </label>
        <select
          id="workspace-switcher"
          value={workspaceId}
          disabled={switching}
          onChange={(e) => {
            void switchWorkspace(e.target.value);
          }}
        >
          {joined.data?.workspaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <Link to="/workspaces" className="browse-link">
          Browse & create workspaces <span aria-hidden="true">↗</span>
        </Link>
        <nav aria-label="Workspace navigation">
          <Link
            to="/w/$workspaceId"
            params={{ workspaceId }}
            activeOptions={{ exact: true }}
            onClick={() => setMenuOpen(false)}
          >
            ⌂ <span>Home</span>
          </Link>
          <Link
            to="/w/$workspaceId/contacts"
            params={{ workspaceId }}
            onClick={() => setMenuOpen(false)}
          >
            ♧ <span>Contacts</span>
          </Link>
          {upcoming.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-label">{group.label}</span>
              {group.items.map((item) => (
                <button disabled title="Available in a future release" key={item}>
                  <span className="nav-dot" aria-hidden="true" />
                  {item}
                  <span className="soon">Soon</span>
                </button>
              ))}
            </div>
          ))}
          <div className="nav-group">
            <span className="nav-label">Workspace</span>
            <Link
              to="/w/$workspaceId/members"
              params={{ workspaceId }}
              onClick={() => setMenuOpen(false)}
            >
              ♙ <span>Members</span>
            </Link>
            {canManageSettings(workspace.role) && (
              <Link
                to="/w/$workspaceId/settings"
                params={{ workspaceId }}
                onClick={() => setMenuOpen(false)}
              >
                ⚙ <span>Settings</span>
              </Link>
            )}
          </div>
        </nav>
        <Link to="/profile" className="sidebar-profile">
          <Avatar name={session.data.user.name} />
          <span>
            {session.data.user.name}
            <small>Your profile & account</small>
          </span>
        </Link>
      </aside>
      <div className="app-body">
        <header className="app-topbar">
          <div>
            <span className="status-dot" aria-hidden="true" />
            <strong>{workspace.name}</strong>
            <span className="badge">{workspace.role}</span>
          </div>
          <Link className="button compact" to="/onboarding">
            + New workspace
          </Link>
        </header>
        <main id="main-content" className="app-main">
          <ErrorMessage error={error} />
          {switching ? <Loading label="Switching workspace…" /> : <Outlet key={workspaceId} />}
        </main>
        <footer className="app-footer">Lumo · One Workspace. Everything Connected.</footer>
      </div>
    </div>
  );
}
