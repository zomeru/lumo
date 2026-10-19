import { useId, type InputHTMLAttributes, type ReactNode } from "react";

export function Brand() {
  return (
    <a href="/" className="brand" aria-label="Lumo home">
      <span className="brand-mark" aria-hidden="true">
        L<span />
      </span>
      <span>
        LUMO<small>One Workspace. Everything Connected.</small>
      </span>
    </a>
  );
}
export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={hint ? `${id}-hint` : undefined} {...props} />
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
export function SelectField({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} {...props}>
        {children}
      </select>
    </div>
  );
}
export function ErrorMessage({ error }: { error: unknown }) {
  return error ? (
    <p className="notice error" role="alert">
      {error instanceof Error ? error.message : "Something went wrong. Please try again."}
    </p>
  ) : null;
}
export function Loading({ label = "Loading your workspace…" }: { label?: string }) {
  return (
    <output className="loading">
      <span className="spinner" aria-hidden="true" />
      {label}
    </output>
  );
}
export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()}
    </span>
  );
}
