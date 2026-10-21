import { fileModules } from "@lumo/contracts/files";
import { canManageSettings } from "@lumo/contracts/permissions";
import {
  Avatar,
  Badge,
  Brand,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
  ErrorMessage,
  Loading,
  SelectField,
  ThemeMenu,
  cn,
} from "@lumo/ui";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  ArrowUpRight,
  ChevronRight,
  CalendarDays,
  CircleHelp,
  FileText,
  House,
  LayoutGrid,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { AppHeader } from "../../chrome";
import { clearWorkspaceCache, sessionQuery, workspaceQuery, workspacesQuery } from "../../lib/api";
import { moduleRoutes, moduleIcons } from "../office/file-modules";

const navigationLink =
  "flex min-h-9 items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:font-medium aria-[current=page]:text-accent-foreground [&_svg]:size-4 [&_svg]:shrink-0";
function NavigationGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-6">
      <span className="mb-2 block px-3 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      <div className="grid gap-0.5">{children}</div>
    </div>
  );
}
export function WorkspaceShell({ workspaceId }: { workspaceId: string }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const editorLayout = /\/(?:documents|docs|sheets|slides)\/[^/]+$|\/wiki(?:\/|$)/.test(pathname);
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
      <main id="main-content" className="mx-auto my-16 grid max-w-xl gap-5 px-6">
        <h1>Workspace unavailable</h1>
        <p>You may no longer be a member of this workspace.</p>
        <ErrorMessage error={ws.error} />
        <Button asChild variant="primary">
          <Link to="/workspaces">Your workspaces</Link>
        </Button>
      </main>
    );
  if (!ws.data || !session.data) return <Loading />;
  const workspace = ws.data;
  const navigation = (
    <>
      <div className="px-5 pt-5 pb-6">
        <Brand compact />
      </div>
      <div className="px-4">
        <SelectField
          label="Workspace"
          value={workspaceId}
          disabled={switching}
          onValueChange={(id) => {
            void switchWorkspace(id);
          }}
          options={(joined.data?.workspaces ?? [workspace]).map((item) => ({
            value: item.id,
            label: item.name,
          }))}
        />
        <Link
          to="/workspaces"
          className="mt-2.5 mb-5 flex items-center justify-between px-0.5 text-xs text-muted-foreground hover:text-primary"
        >
          Browse & create workspaces
          <ArrowUpRight className="size-3" aria-hidden="true" />
        </Link>
      </div>
      <nav aria-label="Workspace navigation" className="min-h-0 flex-1 overflow-y-auto px-3 pb-6">
        <Link
          className={navigationLink}
          to="/w/$workspaceId"
          params={{ workspaceId }}
          activeOptions={{ exact: true }}
          onClick={() => setMenuOpen(false)}
        >
          <House aria-hidden="true" />
          Home
        </Link>
        <Link
          className={navigationLink}
          to="/w/$workspaceId/contacts"
          params={{ workspaceId }}
          onClick={() => setMenuOpen(false)}
        >
          <Users aria-hidden="true" />
          Contacts
        </Link>
        <NavigationGroup label="Connect">
          <Link
            className={navigationLink}
            to="/w/$workspaceId/messenger"
            params={{ workspaceId }}
            onClick={() => setMenuOpen(false)}
          >
            <MessageSquare aria-hidden="true" />
            Messenger
          </Link>
          <Link
            className={navigationLink}
            to="/w/$workspaceId/meetings"
            params={{ workspaceId }}
            onClick={() => setMenuOpen(false)}
          >
            <Video aria-hidden="true" />
            Meetings
          </Link>
          <Link
            className={navigationLink}
            to="/w/$workspaceId/calendar"
            params={{ workspaceId }}
            activeOptions={{ includeSearch: false }}
            onClick={() => setMenuOpen(false)}
          >
            <CalendarDays aria-hidden="true" />
            Calendar
          </Link>
        </NavigationGroup>
        <NavigationGroup label="Create">
          {(["docs", "sheets", "slides", "wiki", "drive"] as const).map((module) => {
            const Icon = moduleIcons[module];
            return (
              <Link
                key={module}
                className={navigationLink}
                to={moduleRoutes[module]}
                params={{ workspaceId }}
                activeOptions={{ includeSearch: false }}
                onClick={() => setMenuOpen(false)}
              >
                <Icon aria-hidden="true" />
                {fileModules[module].title}
              </Link>
            );
          })}
          <Link
            className={navigationLink}
            to={moduleRoutes.all}
            params={{ workspaceId }}
            activeOptions={{ includeSearch: false }}
            onClick={() => setMenuOpen(false)}
          >
            <moduleIcons.all aria-hidden="true" />
            {fileModules.all.title}
          </Link>
        </NavigationGroup>
        <NavigationGroup label="People & HR">
          <Link
            className={navigationLink}
            to="/w/$workspaceId/people"
            params={{ workspaceId }}
            onClick={() => setMenuOpen(false)}
          >
            <Users aria-hidden="true" />
            People
          </Link>
        </NavigationGroup>
        <NavigationGroup label="Workspace">
          <Link
            className={navigationLink}
            to="/w/$workspaceId/members"
            params={{ workspaceId }}
            onClick={() => setMenuOpen(false)}
          >
            <Users aria-hidden="true" />
            Members
          </Link>
          {canManageSettings(workspace.role) && (
            <Link
              className={navigationLink}
              to="/w/$workspaceId/settings"
              params={{ workspaceId }}
              onClick={() => setMenuOpen(false)}
            >
              <Settings aria-hidden="true" />
              Settings
            </Link>
          )}
        </NavigationGroup>
        <details className="mt-6">
          <summary className="flex list-none items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground">
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            More tools<Badge className="ml-auto text-[10px]">Soon</Badge>
          </summary>
          <div className="mt-1 grid gap-0.5">
            {["Tasks", "Projects", "Approvals", "Leave", "Attendance", "Hiring"].map((item) => (
              <button
                type="button"
                disabled
                title="Available in a future release"
                className={cn(navigationLink, "w-full cursor-default opacity-50")}
                key={item}
              >
                <FileText aria-hidden="true" />
                {item}
              </button>
            ))}
          </div>
        </details>
      </nav>
      <div className="mx-4 mb-4 flex items-start gap-2 rounded-lg border border-dashed p-3">
        <CircleHelp className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs">
          A space for your people.
          <br />
          Make something great together.
        </p>
      </div>
      <Link
        to="/profile"
        onClick={() => setMenuOpen(false)}
        className="flex items-center gap-2.5 border-t px-4 py-4 hover:bg-muted"
      >
        <Avatar name={session.data.user.name} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium">
          {session.data.user.name}
          <small className="mt-0.5 text-[10px] font-normal">Your profile & account</small>
        </span>
        <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
      </Link>
    </>
  );
  return (
    <div className="min-h-dvh">
      <aside
        data-app-sidebar=""
        hidden={menuOpen}
        className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r bg-sidebar lg:flex"
      >
        {navigation}
      </aside>
      <div
        className={cn(
          "flex min-w-0 flex-col lg:ml-60",
          editorLayout ? "h-dvh overflow-hidden" : "min-h-dvh",
        )}
      >
        <AppHeader className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b bg-surface px-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Dialog open={menuOpen} onOpenChange={setMenuOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label={menuOpen ? "Close navigation" : "Open navigation"}
                  disabled={switching}
                >
                  <Menu aria-hidden="true" />
                </Button>
              </DialogTrigger>
              <DialogContent className="inset-y-0 left-0 h-dvh max-h-dvh w-72 max-w-[90vw] overflow-hidden translate-x-0 translate-y-0 gap-0 rounded-none border-y-0 border-l-0 bg-sidebar p-0 sm:p-0">
                <DialogTitle className="sr-only">Workspace navigation</DialogTitle>
                <DialogDescription className="sr-only">
                  Switch workspaces and open your team’s tools.
                </DialogDescription>
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{navigation}</div>
              </DialogContent>
            </Dialog>
            <LayoutGrid
              className="hidden size-4 text-muted-foreground sm:block"
              aria-hidden="true"
            />
            <strong className="truncate text-sm">{workspace.name}</strong>
            <Badge className="hidden capitalize sm:inline-flex">{workspace.role}</Badge>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3">
            <ThemeMenu />
            <Button asChild size="sm">
              <Link to="/onboarding">
                <Plus aria-hidden="true" />
                New workspace
              </Link>
            </Button>
          </div>
        </AppHeader>
        <main
          id="main-content"
          className={
            editorLayout
              ? "flex min-h-0 w-full flex-1 flex-col overflow-hidden"
              : "mx-auto w-full max-w-7xl flex-1 space-y-6 px-4 py-7 sm:px-8 sm:py-9 xl:px-10"
          }
        >
          <ErrorMessage error={error} />
          {switching ? <Loading label="Switching workspace…" /> : <Outlet key={workspaceId} />}
        </main>
        {!editorLayout && (
          <footer className="flex items-center justify-between gap-3 border-t px-5 py-4 text-[10px] text-muted-foreground sm:px-8">
            <span>Lumo · Everything, connected.</span>
            <span className="flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-success" aria-hidden="true" />
              Your team’s space
            </span>
          </footer>
        )}
      </div>
    </div>
  );
}
