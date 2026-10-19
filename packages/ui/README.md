# Lumo UI

The shared DOM component library for web and Electron. Import components from `@lumo/ui` and import `@lumo/ui/styles.css` once in each renderer. Both renderers use `@tailwindcss/vite`; no Tailwind JavaScript configuration is needed.

## Theme and source detection

`src/tokens.ts` owns platform-independent semantic colors, spacing, control height, radii, font family, and motion values. The generated `src/theme.css` adapts those values to CSS variables and Tailwind v4 `@theme` tokens. A future native app can import `@lumo/ui/tokens` without loading React or browser CSS.

After changing tokens, run:

```sh
pnpm --filter @lumo/ui theme:generate
pnpm exec oxfmt --write packages/ui/src/theme.css
```

The UI type check also checks that the generated theme matches its source. `styles.css` explicitly scans UI, shared app, web, and desktop renderer sources using stylesheet-relative `@source` paths. Write complete utility class names; string interpolation cannot generate Tailwind classes.

Use semantic utilities such as `bg-surface`, `text-muted-foreground`, `border-border`, and `bg-primary`. `h-control` and `size-control` use the shared control size. `cn()` merges class overrides and understands the custom spacing token.

Call `initializeTheme()` before mounting a renderer. The shared root installs `ThemeProvider`, `TooltipProvider`, and `ToastProvider`. `ThemeMenu` offers light, dark, and system appearance, preserves the preference, and follows changes in the OS or other windows. Storage restrictions still allow a session preference.

## Components

- Forms: `Button`, `Input`, `PasswordInput`, `Textarea`, `FormField`, `Field`, `SelectField`, `Combobox`, `MultiSelectField`, `Checkbox`, `RadioGroup`, and `Switch`.
- Overlays: composable `Dialog`, `AlertDialog`, `DropdownMenu`, `ContextMenu`, `Popover`, and `Tooltip` parts. `ConfirmAction` is available at `@lumo/ui/confirm-action`.
- Content: `Tabs`, `Badge`, `Card`, `Avatar`, semantic `Table` parts, `ScrollArea`, and `Separator`.
- Feedback: `Skeleton`, `Spinner`, native `Progress`, `Loading`, `Notice`, `ErrorMessage`, `EmptyState`, and `useToast()`.

Button variants are `primary`, `secondary`, `ghost`, `destructive`, and `link`; sizes are `sm`, `md`, `lg`, and `icon`. Buttons default to `type="button"`; set `type="submit"` for form submission. Use `asChild` to preserve link semantics. Use `loading` for asynchronous actions and provide text or an accessible name for icon buttons.

`FormField` associates its child control with a label, help text, and error message. `Field` adds that structure to an input and automatically uses the password visibility control for `type="password"`. Password visibility buttons never submit forms.

`SelectField` accepts `options: { value, label, disabled? }[]`, `value`/`onValueChange` or `defaultValue`, and native form properties such as `name`, `required`, and `disabled`. It uses a Radix trigger, portaled content, keyboard navigation, typeahead, collision-aware positioning, and scroll controls. An empty default value displays the placeholder. The composable `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, and `SelectItem` parts support custom layouts.

`Combobox` adds searchable single selection. `MultiSelectField` adds searchable checkbox selection and submits repeated named values with `FormData.getAll()`. Both accept controlled or uncontrolled values. Menus and dialogs use Radix focus management; include a dialog title and description, and use the provided trigger/close parts so focus returns to its origin.

Component customization uses `className`, composition, and primitive props. Keep screen layout in `packages/app`. Keep Electron window behavior outside the UI library. The only handwritten global CSS is the Tailwind entry, generated tokens, base typography, reduced-motion support, and SDK-created media containers.

## Validation

```sh
pnpm test --project ui
pnpm test --project web
pnpm check-types
pnpm build
pnpm test:e2e
pnpm test:desktop
```

UI tests cover form serialization, controlled state, keyboard navigation, focus restoration, menus, dialogs, password visibility, appearance preferences, and notification dismissal. Browser tests exercise desktop and mobile web layouts against the real API; desktop tests use the built Electron renderer.
