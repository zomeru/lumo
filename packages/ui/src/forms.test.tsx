import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { expect, test, vi } from "vitest";

import { Button } from "./button";
import { Combobox, MultiSelectField } from "./combobox";
import { Checkbox, RadioGroup, RadioGroupItem, Switch } from "./controls";
import { Field, FormField, Textarea } from "./input";
import { SelectField } from "./select";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta", disabled: true },
  { value: "c", label: "Charlie" },
];
test("select supports keyboard navigation, skips disabled options, submits and restores focus", async () => {
  const user = userEvent.setup(),
    submit = vi.fn<(...args: unknown[]) => void>();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit(Object.fromEntries(new FormData(event.currentTarget)));
      }}
    >
      <SelectField label="Team" name="team" defaultValue="a" options={options} />
      <Button type="submit">Save</Button>
    </form>,
  );
  const trigger = screen.getByRole("combobox", { name: "Team" });
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  expect(await screen.findByRole("listbox")).toBeVisible();
  await user.keyboard("{End}{Enter}");
  expect(trigger).toHaveTextContent("Charlie");
  await waitFor(() => expect(trigger).toHaveFocus());
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(submit).toHaveBeenCalledWith({ team: "c" });
  await user.click(trigger);
  expect(screen.getByRole("option", { name: "Beta" })).toHaveAttribute("data-disabled");
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
});
test("select supports controlled updates, invalid descriptions and disabled fields", async () => {
  function Controlled() {
    const [value, setValue] = useState("a");
    return (
      <>
        <SelectField
          label="Controlled"
          value={value}
          onValueChange={setValue}
          options={options}
          hint="Choose a team"
          error="Team is unavailable"
          size="sm"
        />
        <SelectField label="Disabled" disabled options={options} />
      </>
    );
  }
  const user = userEvent.setup();
  render(<Controlled />);
  const trigger = screen.getByRole("combobox", { name: "Controlled" });
  expect(trigger).toHaveAttribute("aria-invalid", "true");
  expect(trigger).toHaveAccessibleDescription("Team is unavailable");
  expect(screen.getByRole("combobox", { name: "Disabled" })).toBeDisabled();
  await user.click(trigger);
  await user.click(screen.getByRole("option", { name: "Charlie" }));
  expect(trigger).toHaveTextContent("Charlie");
});
test("password visibility does not submit the form or lose the value and errors name the control", async () => {
  const user = userEvent.setup(),
    submit = vi.fn<(...args: unknown[]) => void>();
  render(
    <form onSubmit={submit}>
      <Field
        label="Password"
        name="password"
        type="password"
        hint="At least 12 characters"
        error="Too short"
      />
      <FormField label="Notes">
        <Textarea />
      </FormField>
    </form>,
  );
  const input = screen.getByLabelText("Password");
  await user.type(input, "Secret text");
  await user.click(screen.getByRole("button", { name: "Show password" }));
  expect(input).toHaveAttribute("type", "text");
  expect(input).toHaveValue("Secret text");
  expect(input).toHaveAccessibleDescription("At least 12 characters Too short");
  expect(screen.getByRole("alert")).toHaveTextContent("Too short");
  await user.click(screen.getByRole("button", { name: "Hide password" }));
  expect(input).toHaveAttribute("type", "password");
  expect(submit).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText("Notes"), "A useful note");
});
test("combobox searches, announces empty results, supports keyboard selection and form values", async () => {
  const user = userEvent.setup(),
    change = vi.fn<(...args: unknown[]) => void>();
  const { container } = render(
    <form>
      <Combobox label="People" name="person" options={options} onValueChange={change} />
    </form>,
  );
  await user.click(screen.getByRole("combobox", { name: "People" }));
  const search = screen.getByRole("combobox", { name: "Search people" });
  await user.type(search, "Nobody");
  expect(screen.getByText("No options found.")).toBeVisible();
  await user.clear(search);
  await user.type(search, "char");
  await user.keyboard("{ArrowDown}{Enter}");
  await waitFor(() =>
    expect(screen.getByRole("combobox", { name: "People" })).toHaveTextContent("Charlie"),
  );
  expect(change).toHaveBeenCalledWith("c");
  expect(new FormData(container.querySelector("form")!).get("person")).toBe("c");
});
test("multiselect preserves all selected form values while filtering, toggling and reopening", async () => {
  const user = userEvent.setup(),
    change = vi.fn<(...args: unknown[]) => void>();
  const { container } = render(
    <form>
      <MultiSelectField
        label="Participants"
        name="people"
        options={options}
        onValueChange={change}
      />
    </form>,
  );
  await user.click(screen.getByRole("button", { name: "Participants" }));
  await user.click(screen.getByRole("checkbox", { name: "Alpha" }));
  await user.type(screen.getByRole("searchbox"), "char");
  await user.click(screen.getByRole("checkbox", { name: "Charlie" }));
  expect(new FormData(container.querySelector("form")!).getAll("people")).toEqual(["a", "c"]);
  await user.clear(screen.getByRole("searchbox"));
  await user.click(screen.getByRole("checkbox", { name: "Alpha" }));
  expect(change).toHaveBeenLastCalledWith(["c"]);
  await user.type(screen.getByRole("searchbox"), "Nobody");
  expect(screen.getByText("No people found.")).toBeVisible();
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: "Participants" })).toHaveTextContent("1 selected");
});
test("checkbox, switch and radio group support keyboard operation and named form data", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <form>
      <label htmlFor="check">Remember me</label>
      <Checkbox id="check" name="remember" />
      <label htmlFor="switch">Notifications</label>
      <Switch id="switch" name="notifications" />
      <RadioGroup aria-label="Density" name="density" defaultValue="compact">
        <label htmlFor="compact">Compact</label>
        <RadioGroupItem id="compact" value="compact" />
        <label htmlFor="comfortable">Comfortable</label>
        <RadioGroupItem id="comfortable" value="comfortable" />
      </RadioGroup>
    </form>,
  );
  screen.getByRole("checkbox", { name: "Remember me" }).focus();
  await user.keyboard(" ");
  screen.getByRole("switch", { name: "Notifications" }).focus();
  await user.keyboard(" ");
  screen.getByRole("radio", { name: "Compact" }).focus();
  await user.keyboard("{ArrowDown>}");
  await waitFor(() => expect(screen.getByRole("radio", { name: "Comfortable" })).toBeChecked());
  await user.keyboard("{/ArrowDown}");
  expect(Object.fromEntries(new FormData(container.querySelector("form")!))).toEqual({
    remember: "on",
    notifications: "on",
    density: "comfortable",
  });
});
test("loading buttons prevent repeated actions while links retain their semantics", async () => {
  const click = vi.fn<(...args: unknown[]) => void>(),
    user = userEvent.setup();
  render(
    <>
      <Button loading onClick={click}>
        Saving
      </Button>
      <Button asChild variant="link">
        <a href="/profile">Profile</a>
      </Button>
      <Button disabled>Disabled</Button>
    </>,
  );
  await user.click(screen.getByRole("button", { name: "Saving" }));
  expect(click).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Saving" })).toHaveAttribute("aria-busy", "true");
  expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute("href", "/profile");
});

test("custom utility sizes override the shared control token", () => {
  render(<Button className="h-11">Larger action</Button>);
  expect(screen.getByRole("button", { name: "Larger action" })).toHaveClass("h-11");
  expect(screen.getByRole("button", { name: "Larger action" })).not.toHaveClass("h-control");
});

test("optional selects can clear back to the placeholder and submit an empty value", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <form>
      <SelectField
        label="Industry"
        name="industry"
        defaultValue="a"
        placeholder="Choose an industry"
        options={[{ value: "", label: "No industry" }, ...options]}
      />
    </form>,
  );
  await user.click(screen.getByRole("combobox", { name: "Industry" }));
  await user.click(screen.getByRole("option", { name: "No industry" }));
  expect(screen.getByRole("combobox", { name: "Industry" })).toHaveTextContent(
    "Choose an industry",
  );
  expect(new FormData(container.querySelector("form")!).get("industry")).toBe("");
});

test("required comboboxes block submission until a value is chosen", async () => {
  const user = userEvent.setup(),
    submit = vi.fn<() => void>();
  render(
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <Combobox label="Required team" name="team" required options={options} />
      <Button type="submit">Save team</Button>
    </form>,
  );
  await user.click(screen.getByRole("button", { name: "Save team" }));
  expect(submit).not.toHaveBeenCalled();
  expect(screen.getByRole("alert")).toHaveTextContent("Choose an option.");
  await user.click(screen.getByRole("option", { name: "Alpha" }));
  await user.click(screen.getByRole("button", { name: "Save team" }));
  expect(submit).toHaveBeenCalledOnce();
});

test("disabled links do not navigate or activate child click handlers", async () => {
  const user = userEvent.setup(),
    click = vi.fn<() => void>();
  render(
    <Button asChild disabled>
      <a href="/profile" onClick={click}>
        Unavailable profile
      </a>
    </Button>,
  );
  const link = screen.getByRole("link", { name: "Unavailable profile" });
  expect(link).toHaveAttribute("aria-disabled", "true");
  expect(link).toHaveAttribute("tabindex", "-1");
  await user.click(link);
  expect(click).not.toHaveBeenCalled();
});
