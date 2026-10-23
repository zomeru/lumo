import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { Button } from "./button";
import { ConfirmAction } from "./confirm-action";
import { ScrollArea, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from "./controls";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./dialog";
import {
  Avatar,
  Badge,
  Card,
  Progress,
  Skeleton,
  Spinner,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./display";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuLabel,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
} from "./menu";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipProvider,
} from "./popover";
import { initializeTheme, ThemeMenu, ThemeProvider } from "./theme";
import { ToastProvider, useToast } from "./toast";
import { Brand, EmptyState, ErrorMessage, Loading, Notice, PageHeading } from "./ui";

test("dialogs trap focus, close on Escape and restore focus to the trigger", async () => {
  const user = userEvent.setup();
  render(
    <Dialog>
      <DialogTrigger asChild>
        <Button>Open editor</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Edit workspace</DialogTitle>
        <DialogDescription>Change the workspace name.</DialogDescription>
        <Button>Save name</Button>
      </DialogContent>
    </Dialog>,
  );
  const trigger = screen.getByRole("button", { name: "Open editor" });
  await user.click(trigger);
  const dialog = screen.getByRole("dialog", { name: "Edit workspace" });
  expect(dialog).toHaveAccessibleDescription("Change the workspace name.");
  await user.tab();
  await user.tab();
  expect(dialog).toContainElement(document.activeElement as HTMLElement);
  await user.keyboard("{Escape}");
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  await user.click(trigger);
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
});
test("destructive confirmations default to cancel and run only after confirmation", async () => {
  const user = userEvent.setup(),
    confirm = vi.fn<(...args: unknown[]) => void>();
  render(
    <ConfirmAction
      label="Remove member"
      message="Workspace access will end immediately."
      onConfirm={confirm}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Remove member" }));
  const dialog = screen.getByRole("alertdialog", { name: "Remove member?" });
  expect(dialog).toHaveAccessibleDescription("Workspace access will end immediately.");
  expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
  await user.keyboard("{Enter}");
  expect(confirm).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Remove member" }));
  await user.click(screen.getByRole("button", { name: "Confirm remove member" }));
  expect(confirm).toHaveBeenCalledOnce();
});
test("menus support keyboard selection, disabled items, submenus and dismiss", async () => {
  const user = userEvent.setup(),
    select = vi.fn<(...args: unknown[]) => void>();
  render(
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button>Actions</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Workspace</DropdownMenuLabel>
        <DropdownMenuItem disabled>Unavailable</DropdownMenuItem>
        <DropdownMenuItem onSelect={select}>Copy link</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem destructive>Delete</DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>,
  );
  screen.getByRole("button", { name: "Actions" }).focus();
  await user.keyboard("{ArrowDown}");
  expect(screen.getByRole("menuitem", { name: "Unavailable" })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await user.keyboard("{Home}{Enter}");
  expect(select).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Actions" }));
  screen.getByRole("menuitem", { name: "More" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(await screen.findByRole("menuitem", { name: "Delete" })).toBeVisible();
  await user.keyboard("{Escape}{Escape}");
});
test("context menus expose actions and submenus without requiring a pointer", async () => {
  render(
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <Button>Message actions</Button>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Message</ContextMenuLabel>
        <ContextMenuItem>Copy message</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>More</ContextMenuSubTrigger>
          <ContextMenuSubContent>
            <ContextMenuItem destructive>Remove</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
      </ContextMenuContent>
    </ContextMenu>,
  );
  // Browser contextmenu is also raised by the keyboard context menu key.
  fireEvent.contextMenu(screen.getByRole("button", { name: "Message actions" }), {
    clientX: 10,
    clientY: 10,
  });
  const user = userEvent.setup();
  expect(screen.getByRole("menuitem", { name: "Copy message" })).toBeVisible();
  screen.getByRole("menuitem", { name: "More" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(await screen.findByRole("menuitem", { name: "Remove" })).toBeVisible();
  await user.keyboard("{Escape}{Escape}");
});
test("popovers and tooltips have named content and dismiss correctly", async () => {
  const user = userEvent.setup();
  render(
    <TooltipProvider delayDuration={0}>
      <Tooltip content="Workspace preferences">
        <Button>Help</Button>
      </Tooltip>
      <Popover>
        <PopoverTrigger asChild>
          <Button>Details</Button>
        </PopoverTrigger>
        <PopoverContent aria-label="Workspace details">
          <p>Private workspace</p>
          <PopoverClose asChild>
            <Button>Done</Button>
          </PopoverClose>
        </PopoverContent>
      </Popover>
    </TooltipProvider>,
  );
  await user.hover(screen.getByRole("button", { name: "Help" }));
  expect(await screen.findByRole("tooltip")).toHaveTextContent("Workspace preferences");
  await user.unhover(screen.getByRole("button", { name: "Help" }));
  await user.click(screen.getByRole("button", { name: "Details" }));
  expect(screen.getByRole("dialog", { name: "Workspace details" })).toHaveTextContent(
    "Private workspace",
  );
  await user.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});
test("tabs support arrow navigation and label the selected panel", async () => {
  const user = userEvent.setup();
  render(
    <Tabs defaultValue="profile">
      <TabsList aria-label="Account settings">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="account">Account</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">Your name</TabsContent>
      <TabsContent value="account">Your account</TabsContent>
    </Tabs>,
  );
  screen.getByRole("tab", { name: "Profile" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("tab", { name: "Account" })).toHaveAttribute("aria-selected", "true");
  expect(screen.getByRole("tabpanel", { name: "Account" })).toHaveTextContent("Your account");
  expect(screen.queryByText("Your name")).not.toBeInTheDocument();
});
test("theme follows system changes, persists explicit preferences and synchronizes other windows", async () => {
  const target = new EventTarget();
  const media = {
    matches: false,
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
  };
  vi.stubGlobal("matchMedia", () => media);
  initializeTheme();
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  const user = userEvent.setup();
  const { unmount } = render(
    <ThemeProvider>
      <ThemeMenu />
    </ThemeProvider>,
  );
  act(() => {
    media.matches = true;
    target.dispatchEvent(new Event("change"));
  });
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  await user.click(screen.getByRole("button", { name: "Change appearance" }));
  await user.click(screen.getByRole("menuitemcheckbox", { name: "Light" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "light");
  expect(localStorage.getItem("lumolynk.theme.v1")).toBe("light");
  act(() => {
    localStorage.setItem("lumolynk.theme.v1", "dark");
    window.dispatchEvent(new StorageEvent("storage", { key: "lumolynk.theme.v1" }));
  });
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  unmount();
  vi.unstubAllGlobals();
});
test("unavailable preference storage does not prevent theme selection", async () => {
  const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  initializeTheme();
  const user = userEvent.setup();
  render(
    <ThemeProvider>
      <ThemeMenu />
    </ThemeProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Change appearance" }));
  await user.click(screen.getByRole("menuitemcheckbox", { name: "Dark" }));
  expect(document.documentElement).toHaveAttribute("data-theme", "dark");
  get.mockRestore();
  set.mockRestore();
});
function Notify() {
  const notify = useToast();
  return (
    <Button
      onClick={() => notify({ title: "Link copied", description: "Share it with your colleague." })}
    >
      Copy
    </Button>
  );
}
test("notifications announce results and can be dismissed", async () => {
  const user = userEvent.setup();
  render(
    <ToastProvider>
      <Notify />
    </ToastProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Copy" }));
  expect(await screen.findByText("Link copied")).toBeVisible();
  expect(screen.getByText("Share it with your colleague.")).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Dismiss notification" }));
  await waitFor(() => expect(screen.queryByText("Link copied")).not.toBeInTheDocument());
});
test("data and feedback components retain useful document semantics", () => {
  render(
    <>
      <Brand />
      <Brand compact />
      <PageHeading eyebrow="Workspace" title="Members" actions={<Button>Invite</Button>}>
        Your team.
      </PageHeading>
      <Card>
        <Avatar name="Alice Chen" size="lg" />
        <Avatar name="" size="sm" src="/missing.png" />
        <Badge variant="success">Active</Badge>
        <Skeleton className="h-5 w-20" />
        <Spinner label="Refreshing members" />
        <Progress aria-label="Setup progress" value={50} />
        <ScrollArea className="h-20">
          <Table>
            <TableCaption>Workspace members</TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>Alice Chen</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </ScrollArea>
        <Separator />
        <Separator orientation="vertical" />
      </Card>
      <EmptyState title="No matches" icon={<span aria-hidden="true">?</span>}>
        Try another search.
      </EmptyState>
      <ErrorMessage error="unknown" />
      <ErrorMessage error={new Error("Unavailable")} />
      <ErrorMessage error={null} />
      <Loading />
      <Notice>Saved.</Notice>
    </>,
  );
  expect(screen.getByRole("table", { name: "Workspace members" })).toBeInTheDocument();
  expect(screen.getByRole("progressbar", { name: "Setup progress" })).toHaveValue(50);
  expect(screen.getAllByRole("alert")).toHaveLength(2);
  expect(screen.getByText("AC")).toBeInTheDocument();
  expect(screen.getByText("Refreshing members")).toBeInTheDocument();
});
