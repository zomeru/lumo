import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { ViewNavigation, ViewNavigationItem, ViewTabs } from "./view-navigation";

test("section views support keyboard activation and expose the current view", async () => {
  const change = vi.fn<(value: string) => void>(),
    user = userEvent.setup();
  const { rerender } = render(
    <ViewTabs tabs={["My Pay", "Pay Runs"]} value="My Pay" onChange={change} />,
  );
  expect(screen.getByRole("navigation", { name: "Section views" })).toBeVisible();
  expect(screen.getByRole("button", { name: "My Pay" })).toHaveAttribute("aria-current", "page");
  await user.tab();
  await user.tab();
  await user.keyboard("{Enter}");
  expect(change).toHaveBeenCalledWith("Pay Runs");
  rerender(<ViewTabs tabs={["My Pay", "Pay Runs"]} value="Pay Runs" onChange={change} />);
  expect(screen.getByRole("button", { name: "My Pay" })).not.toHaveAttribute("aria-current");
  expect(screen.getByRole("button", { name: "Pay Runs" })).toHaveAttribute("aria-current", "page");
});
test("view navigation composes real links and keeps disabled actions inactive", async () => {
  const click = vi.fn<() => void>(),
    user = userEvent.setup();
  render(
    <ViewNavigation aria-label="Files">
      <ViewNavigationItem active asChild>
        <a href="/files">All files</a>
      </ViewNavigationItem>
      <ViewNavigationItem active={false} disabled onClick={click}>
        Unavailable
      </ViewNavigationItem>
    </ViewNavigation>,
  );
  expect(screen.getByRole("link", { name: "All files" })).toHaveAttribute("href", "/files");
  await user.click(screen.getByRole("button", { name: "Unavailable" }));
  expect(click).not.toHaveBeenCalled();
});
