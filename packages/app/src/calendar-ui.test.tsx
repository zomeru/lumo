import type { Meeting } from "@lumo/contracts/collaboration";
import { zonedDateTime } from "@lumo/shared/meeting-time";
import { QueryClient, onlineManager } from "@tanstack/react-query";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

import {
  calendarDays,
  moveCalendar,
  overlapsDay,
  nextMeetingSlot,
  addDays,
} from "./features/meetings/calendar-dates";
import { configurePlatform } from "./platform";
import { createAppRouter } from "./router";
import { mockApi, teamId, personalId, bobId } from "./test/mock-api";
import { selectOption } from "./test/select-option";

const dto = ({ hostName: _host, ...item }: Meeting & { hostName: string }) => item;
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
let server: ReturnType<typeof mockApi>, client: QueryClient;
let meetings: (Meeting & { hostName: string })[];
let posted: Record<string, unknown> | null;
beforeEach(() => {
  // Keep today's noon meeting editable regardless of the time the suite runs.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 21, 8, 0));
  server = mockApi();
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  posted = null;
  const start = new Date();
  start.setHours(12, 0, 0, 0);
  meetings = [
    {
      id,
      title: "Shared planning",
      description: "Review the roadmap",
      access: "workspace",
      hostId: server.state.user.id,
      hostName: "Alice Chen",
      status: "scheduled",
      startsAt: start.toISOString(),
      timezone: "Asia/Shanghai",
      durationMinutes: 60,
      createdAt: new Date().toISOString(),
    },
  ];
  server.state.overrides.set(`GET /api/v1/workspaces/${teamId}/meetings/calendar`, (_body, url) =>
    server.json({
      meetings: meetings.filter(
        (item) =>
          item.startsAt! < url.searchParams.get("to")! &&
          new Date(Date.parse(item.startsAt!) + item.durationMinutes * 60000).toISOString() >
            url.searchParams.get("from")!,
      ),
      nextOffset: null,
    }),
  );
  server.state.overrides.set(`GET /api/v1/workspaces/${teamId}/meetings`, () =>
    server.json({ meetings: meetings.map(dto), nextOffset: null }),
  );
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/meetings/availability`, () =>
    server.json({ conflicts: [] }),
  );
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/meetings`, (body) => {
    posted = body;
    const { participantIds: _participants, ...fields } = body;
    const item = { ...meetings[0]!, ...fields, title: String(body.title), hostName: "Alice Chen" };
    meetings = [item];
    return server.json(dto(item), 201);
  });
  server.state.overrides.set(`GET /api/v1/workspaces/${teamId}/meetings/${id}`, () =>
    server.json({
      meeting: dto(meetings[0]!),
      hostName: meetings[0]!.hostName,
      participants: [{ userId: bobId, name: "Bob Rivera", invited: true, online: false }],
    }),
  );
  server.state.overrides.set(`PATCH /api/v1/workspaces/${teamId}/meetings/${id}`, (body) => {
    posted = body;
    const { participantIds: _participants, ...fields } = body;
    Object.assign(meetings[0]!, fields);
    return server.json(dto(meetings[0]!));
  });
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/meetings/${id}/cancel`, () => {
    meetings[0]!.status = "canceled";
    return server.json({ ok: true });
  });
});
afterEach(async () => {
  await client.cancelQueries();
  client.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  configurePlatform(undefined);
  onlineManager.setOnline(true);
});
async function show(path = `/w/${teamId}/calendar`) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [path] }), client);
  await router.load();
  render(<RouterProvider router={router} />);
  return { user: userEvent.setup(), router };
}
const event = () => screen.getAllByRole("button", { name: /Shared planning/ })[0]!;
const futureLocal = () =>
  zonedDateTime(new Date(Date.now() + 86400000), Intl.DateTimeFormat().resolvedOptions().timeZone);

test("schedules from Meetings, invalidates both lists and preserves success links on closing the search composer", async () => {
  const { user, router } = await show(`/w/${teamId}/meetings`);
  await user.click(await screen.findByRole("link", { name: "Schedule meeting" }));
  const dialog = await screen.findByRole("dialog", { name: "Schedule meeting" });
  expect(screen.getByRole("link", { name: "Calendar", hidden: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  expect(screen.getByRole("link", { name: "Meetings", hidden: true })).not.toHaveAttribute(
    "aria-current",
  );
  await user.type(within(dialog).getByLabelText("Meeting title"), "Tomorrow review");
  fireEvent.change(within(dialog).getByLabelText("Start date and time"), {
    target: { value: futureLocal() },
  });
  await selectOption(user, "Who can join", "Anyone with a Lumo account and link");
  await user.type(screen.getByLabelText("Description / agenda"), "A shared agenda");
  await user.click(within(dialog).getByRole("button", { name: "Schedule meeting" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(await screen.findByText("Meeting saved: Tomorrow review")).toBeVisible();
  expect(posted).toMatchObject({
    title: "Tomorrow review",
    description: "A shared agenda",
    access: "open",
  });
  expect(posted).not.toHaveProperty("hostId");
  expect(router.state.location.search).toEqual({});
  expect(await screen.findByRole("link", { name: "View meeting" })).toHaveAttribute(
    "href",
    `/meetings/${id}`,
  );
  await user.click(screen.getByRole("button", { name: "Copy link" }));
  expect(await screen.findByRole("button", { name: "Link copied" })).toBeVisible();
  await user.click(screen.getByRole("link", { name: "Meetings", hidden: true }));
  expect(await screen.findByRole("heading", { name: "Tomorrow review" })).toBeVisible();
}, 15000);

test("all views support slot selection, event details, editing and cancellation", async () => {
  const { user } = await show();
  await screen.findAllByRole("button", { name: /Shared planning/ });
  await selectOption(user, "Calendar view", "Month");
  await user.click(screen.getByRole("button", { name: "Next date range" }));
  await user.click(screen.getByRole("button", { name: "Previous date range" }));
  await user.click(screen.getByRole("button", { name: "Today" }));
  await selectOption(user, "Calendar view", "Day");
  const slot = screen.getAllByRole("button", { name: /^Schedule .* 10:00$/ })[0]!;
  await user.click(slot);
  expect((screen.getByLabelText("Start date and time") as HTMLInputElement).value).toContain(
    "T10:00",
  );
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
  await user.click(event());
  const detail = await screen.findByRole("dialog", { name: "Shared planning" });
  expect(within(detail).getByText("Organizer: Alice Chen")).toBeVisible();
  expect(within(detail).getByText("Review the roadmap")).toBeVisible();
  await user.click(within(detail).getByRole("button", { name: "Edit / reschedule" }));
  await screen.findByRole("dialog", { name: "Edit scheduled meeting" });
  // Preserve the meeting's scheduling timezone rather than editing in the viewer's timezone.
  expect(screen.getByRole("combobox", { name: "Scheduling timezone (IANA)" })).toHaveTextContent(
    "Asia/Shanghai",
  );
  fireEvent.change(screen.getByLabelText("Start date and time"), {
    target: { value: "2030-01-01T00:30" },
  });
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Meeting saved: Shared planning");
  expect(posted).toMatchObject({ startsAt: "2029-12-31T16:30:00.000Z", participantIds: [bobId] });
  await user.click(event());
  await user.click(await screen.findByRole("button", { name: "Cancel meeting" }));
  await user.click(screen.getByRole("button", { name: "Confirm cancel meeting" }));
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Edit / reschedule" })).not.toBeInTheDocument(),
  );
  expect(
    within(screen.getByRole("dialog", { name: "Shared planning" })).getByText("Canceled"),
  ).toBeVisible();
});

test("shared events remain viewable without granting other members organizer actions", async () => {
  meetings[0]!.hostId = bobId;
  meetings[0]!.hostName = "Bob Rivera";
  const { user } = await show();
  await user.click((await screen.findAllByRole("button", { name: /Shared planning/ }))[0]!);
  await waitFor(() =>
    expect(screen.queryByText("Loading scheduled meeting.")).not.toBeInTheDocument(),
  );
  expect(await screen.findByText("Organizer: Bob Rivera")).toBeVisible();
  expect(screen.queryByRole("button", { name: "Edit / reschedule" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Cancel meeting" })).not.toBeInTheDocument();
});

test("soft conflicts, invalid times and retryable availability failures remain actionable", async () => {
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/meetings/availability`, () =>
    server.json({
      conflicts: [
        {
          id,
          title: "Other meeting",
          startsAt: new Date().toISOString(),
          endsAt: new Date().toISOString(),
          userIds: [server.state.user.id],
        },
      ],
    }),
  );
  const { user } = await show(`/w/${teamId}/calendar?compose=true`);
  await user.type(await screen.findByLabelText("Meeting title"), "Conflict allowed");
  expect(
    await screen.findByText("Organizer or invitee conflicts (saving is allowed):"),
  ).toBeVisible();
  expect(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Schedule meeting",
    }),
  ).toBeEnabled();
  fireEvent.change(screen.getByLabelText("Start date and time"), {
    target: { value: "2020-01-01T10:00" },
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("future start time");
  fireEvent.change(screen.getByLabelText("Start date and time"), {
    target: { value: futureLocal() },
  });
  server.state.overrides.set(`POST /api/v1/workspaces/${teamId}/meetings/availability`, () =>
    server.error(503, "Offline"),
  );
  fireEvent.change(screen.getByLabelText("Duration in minutes"), { target: { value: "61" } });
  await client.invalidateQueries({ queryKey: ["workspace", teamId, "availability"] });
  expect(
    await screen.findByText("Availability unavailable. You may still schedule."),
  ).toBeVisible();
  await user.click(screen.getByRole("button", { name: "Retry availability" }));
  fireEvent.change(screen.getByLabelText("Duration in minutes"), { target: { value: "0" } });
  expect(
    within(screen.getByRole("dialog")).getByRole("button", {
      name: "Schedule meeting",
    }),
  ).toBeDisabled();
});

test("Calendar errors hide cached events and details after failed reauthorization", async () => {
  const { user } = await show();
  await screen.findAllByRole("button", { name: /Shared planning/ });
  server.state.overrides.set(`GET /api/v1/workspaces/${teamId}/meetings/calendar`, () =>
    server.error(404, "Membership revoked"),
  );
  await client.invalidateQueries({ queryKey: ["workspace", teamId, "calendar"] });
  expect(await screen.findByRole("alert")).toHaveTextContent("Membership revoked");
  expect(screen.queryByRole("button", { name: /Shared planning/ })).not.toBeInTheDocument();
  server.state.overrides.set(`GET /api/v1/workspaces/${teamId}/meetings/calendar`, () =>
    server.json({ meetings, nextOffset: null }),
  );
  await user.click(screen.getByRole("button", { name: "Retry Calendar" }));
  await user.click((await screen.findAllByRole("button", { name: /Shared planning/ }))[0]!);
  await screen.findByText("Review the roadmap");
  server.state.overrides.set(`GET /api/v1/workspaces/${teamId}/meetings/${id}`, () =>
    server.error(404, "Access removed"),
  );
  await client.invalidateQueries({ queryKey: ["workspace", teamId, "calendar-detail"] });
  expect(await screen.findByRole("heading", { name: "Meeting unavailable" })).toBeVisible();
  expect(screen.queryByText("Review the roadmap")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Retry" }));
});

test("workspace switches clear all Calendar data and desktop shares the same screen and link origin", async () => {
  const fetch = globalThis.fetch;
  configurePlatform({
    kind: "desktop",
    webOrigin: "https://lumo.test",
    transport: async (path, options) => {
      const result = await fetch(path, {
        method: options.method,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
      return { status: result.status, body: await result.json() };
    },
  });
  const { user, router } = await show();
  await user.click((await screen.findAllByRole("button", { name: /Shared planning/ }))[0]!);
  expect(((await screen.findByLabelText("Share meeting link")) as HTMLInputElement).value).toBe(
    `https://lumo.test/meetings/${id}`,
  );
  await user.click(screen.getByRole("button", { name: "Close dialog" }));
  expect(client.getQueriesData({ queryKey: ["workspace", teamId, "calendar"] })).not.toHaveLength(
    0,
  );
  await selectOption(user, "Workspace", "Alice's Workspace");
  await waitFor(() => expect(router.state.location.pathname).toBe(`/w/${personalId}`));
  expect(screen.queryByText("Shared planning")).not.toBeInTheDocument();
  expect(client.getQueriesData({ queryKey: ["workspace", teamId, "calendar"] })).toHaveLength(0);
});

test("Calendar loads every page within the visible range and refreshes cached schedules on reconnect", async () => {
  const second = {
    ...meetings[0]!,
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    title: "Second page",
  };
  server.state.overrides.set(`GET /api/v1/workspaces/${teamId}/meetings/calendar`, (_body, url) =>
    server.json({
      meetings: url.searchParams.get("offset") === "0" ? meetings : [second],
      nextOffset: url.searchParams.get("offset") === "0" ? 200 : null,
    }),
  );
  await show();
  await screen.findAllByRole("button", { name: /Second page/ });
  expect(
    server.fetch.mock.calls.some(([url]) => typeof url === "string" && url.includes("offset=200")),
  ).toBe(true);
  onlineManager.setOnline(false);
  await client.invalidateQueries({ queryKey: ["workspace", teamId, "calendar"] });
  expect(
    await screen.findByText("You are offline. Showing the last schedule; reconnect to refresh."),
  ).toBeVisible();
  const before = server.fetch.mock.calls.length;
  onlineManager.setOnline(true);
  await waitFor(() => expect(server.fetch.mock.calls.length).toBeGreaterThan(before));
});

test("calendar date boundaries, months, DST and overnight meetings are stable", () => {
  const date = new Date(2026, 0, 31, 12);
  expect(moveCalendar(date, "month", 1).getMonth()).toBe(1);
  expect(moveCalendar(date, "week", 1).getDate()).toBe(7);
  expect(moveCalendar(date, "day", -1).getDate()).toBe(30);
  expect(calendarDays(date, "month")).toHaveLength(42);
  expect(calendarDays(date, "week")[0]!.getDay()).toBe(1);
  const day = calendarDays(date, "day")[0]!;
  expect(
    overlapsDay(
      { startsAt: new Date(day.getTime() - 1800000).toISOString(), durationMinutes: 60 },
      day,
    ),
  ).toBe(true);
  expect(overlapsDay({ startsAt: null, durationMinutes: 60 }, day)).toBe(false);
  expect(overlapsDay({ startsAt: addDays(day, 1).toISOString(), durationMinutes: 60 }, day)).toBe(
    false,
  );
  expect(nextMeetingSlot(date).getTime()).toBeGreaterThan(Date.now());
  expect(nextMeetingSlot(new Date(2035, 0, 1)).getHours()).toBe(9);
});
