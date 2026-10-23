import { Button, ThemeMenu } from "@lumolynk/ui";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { BrandLink } from "../../components/brand-link";

const currentYear = new Date().getFullYear();

const footerGroups = [
  {
    title: "Platform",
    links: [
      { to: "/", label: "Home" },
      { to: "/login", label: "Sign in" },
      { to: "/register", label: "Create account" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About Us" },
      { to: "/contact", label: "Contact Us" },
      { to: "/security", label: "Security" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/terms", label: "Terms of Use" },
      { to: "/cookies", label: "Cookie Policy" },
    ],
  },
] as const;

export function PublicFooter() {
  return (
    <footer className="border-t bg-sidebar text-sidebar-foreground">
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-6 sm:grid-cols-[1fr_2fr] sm:px-8">
        <div className="max-w-xs">
          <BrandLink to="/" compact />
          <p className="mt-2 text-xs leading-5">
            One workspace for your people, conversations and shared work.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            © {currentYear} LumoLynk. All rights reserved.
          </p>
        </div>
        <nav aria-label="Footer navigation" className="grid grid-cols-3 gap-x-4 gap-y-5 text-xs">
          {footerGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-2 font-semibold text-foreground">{group.title}</p>
              <ul className="grid gap-1">
                {group.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="inline-flex rounded-sm py-1 text-muted-foreground transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
    </footer>
  );
}

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <BrandLink to="/" compact />
        <nav aria-label="Main navigation" className="flex items-center gap-3 text-sm">
          <ThemeMenu />
          <Link
            to="/login"
            className="rounded-sm hover:text-primary focus-visible:outline-2 focus-visible:outline-ring"
          >
            Sign in
          </Link>
          <Button asChild variant="primary" size="sm">
            <Link to="/register">Get started</Link>
          </Button>
        </nav>
      </header>
      <main
        id="main-content"
        className="mx-auto w-full max-w-3xl flex-1 px-5 pt-6 pb-10 sm:px-8 sm:pt-9"
      >
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}

export function PublicPage({
  title,
  summary,
  children,
}: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <PublicLayout>
      <Link to="/" className="text-xs text-primary underline-offset-4 hover:underline">
        Home
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      <p className="mt-3 mb-7 text-sm leading-6 text-muted-foreground">{summary}</p>
      <div className="grid gap-6 text-sm leading-7 [&_section]:grid [&_section]:gap-2 [&_h2]:text-base [&_h2]:font-semibold">
        {children}
      </div>
    </PublicLayout>
  );
}
