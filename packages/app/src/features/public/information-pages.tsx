import { Link } from "@tanstack/react-router";

import { LegalContent, legalDocuments, legalUpdated, type LegalDocument } from "./legal-content";
import { PublicPage } from "./public-layout";

export function LegalPage({ document }: { document: LegalDocument }) {
  return (
    <PublicPage title={legalDocuments[document].title} summary={legalDocuments[document].summary}>
      <LegalContent document={document} />
    </PublicPage>
  );
}

export function AboutPage() {
  return (
    <PublicPage
      title="About LumoLynk"
      summary="A shared space for the people and work that move your team forward."
    >
      <section>
        <h2>One place to work together</h2>
        <p>
          LumoLynk brings workspace conversations, meetings, files and shared documents together.
          Move between teams with one account, keep work in context, and give people a clear place
          to collaborate.
        </p>
      </section>
      <section>
        <h2>Built around your team</h2>
        <p>
          Workspaces organize membership, invitations and roles. Chat and meetings connect
          colleagues; Drive and shared office documents keep knowledge close to the conversation.
          Calendar and people operations tools support the everyday rhythm of attendance, leave,
          onboarding and payroll administration.
        </p>
      </section>
      <section>
        <h2>Access with purpose</h2>
        <p>
          Your workspace and permissions determine the information and features you can access.
          Owners and administrators manage their organization’s membership and policies. LumoLynk
          supports collaboration across web and desktop with a consistent experience.
        </p>
      </section>
      <p>
        <Link className="text-primary underline" to="/register">
          Create your account
        </Link>{" "}
        or{" "}
        <Link className="text-primary underline" to="/contact">
          get in touch
        </Link>
        .
      </p>
    </PublicPage>
  );
}

export function ContactPage() {
  return (
    <PublicPage
      title="Contact Us"
      summary="Find the right starting point for account, workspace and privacy questions."
    >
      <p className="rounded-lg border bg-muted/40 p-4 text-xs leading-5">
        Contact setup in progress: the email addresses below are examples and are not monitored. Use
        your organization’s established support channel or contact your workspace administrator for
        assistance.
      </p>
      <section>
        <h2>Account and workspace support</h2>
        <p>
          For invitations, membership, access or organizational records, contact the person who
          invited you or your workspace owner through your organization’s usual channels.
        </p>
        <p className="break-all font-medium">
          support@lumolynk.example{" "}
          <span className="font-normal text-muted-foreground">(example address)</span>
        </p>
      </section>
      <section>
        <h2>Privacy and data requests</h2>
        <p>
          For workplace records, start with your organization’s privacy officer or administrator.
          Describe the record, workspace and request. The platform operator’s privacy contact must
          be confirmed before launch.
        </p>
        <p className="break-all font-medium">
          privacy@lumolynk.example{" "}
          <span className="font-normal text-muted-foreground">(example address)</span>
        </p>
      </section>
      <section>
        <h2>Report a security concern</h2>
        <p>
          Report suspected unauthorized access promptly through your organization’s established
          security channel. Include the affected feature, approximate time and steps to reproduce.
          Never send passwords, session cookies, invitation tokens or private workspace content.
        </p>
        <p className="break-all font-medium">
          security@lumolynk.example{" "}
          <span className="font-normal text-muted-foreground">(example address)</span>
        </p>
      </section>
    </PublicPage>
  );
}

export function CookiePage() {
  return (
    <PublicPage
      title="Cookie Policy"
      summary="The browser technologies that keep you signed in and remember your preferences."
    >
      <p className="text-xs">
        Version 2026-10-21.1 · Last updated {legalUpdated} · Draft for legal review.
      </p>
      <section>
        <h2>Essential authentication cookies</h2>
        <p>
          LumoLynk uses authentication cookies to keep your session attached to requests. Session
          cookies are HTTP-only, use SameSite=Lax and require Secure in production. The session
          lifetime is seven days and may be renewed with activity. Signing out revokes the current
          session.
        </p>
      </section>
      <section>
        <h2>Browser storage and preferences</h2>
        <p>
          Local browser storage remembers your appearance preference. Feature-specific device
          preferences, such as microphone selection, may also be stored on your device. Browser
          permissions control access to your microphone and camera. Application data can also remain
          in memory while a page is open.
        </p>
      </section>
      <section>
        <h2>External services and optional tracking</h2>
        <p>
          Enabled messaging, meeting and office integrations may use their own browser technologies.
          The operator must document the providers actually enabled in each deployment and review
          their notices. LumoLynk’s registration acknowledgement does not authorize advertising or
          optional analytics. Any such addition requires its own assessment and any necessary choice
          before activation.
        </p>
      </section>
      <section>
        <h2>Your controls</h2>
        <p>
          You can clear cookies and site data in your browser settings. Clearing essential cookies
          signs you out; blocking them can prevent authentication. Clearing local storage resets
          stored preferences. These controls do not delete server-side workspace records.
        </p>
      </section>
      <section>
        <h2>Review before launch</h2>
        <p>
          The operator must verify cookie names, actual lifetimes, integration storage and any
          optional tracking against the deployed configuration. Read the{" "}
          <Link className="text-primary underline" to="/privacy">
            Privacy Policy
          </Link>{" "}
          for information about rights and retention.
        </p>
      </section>
    </PublicPage>
  );
}

export function SecurityPage() {
  return (
    <PublicPage
      title="Security"
      summary="Application safeguards, shared responsibilities and a practical approach to protecting teamwork."
    >
      <p className="text-xs">
        Last updated {legalUpdated}. This overview describes application controls; deployment
        practices require operator verification.
      </p>
      <section>
        <h2>Account and session protection</h2>
        <p>
          LumoLynk hashes passwords and requires 12–128 characters. Protected authentication
          cookies, server-side session checks, email verification and request rate limits support
          account security. Keep your credentials private, sign out on shared devices and report
          unexpected account activity.
        </p>
      </section>
      <section>
        <h2>Workspace boundaries</h2>
        <p>
          Server-side membership and role checks govern access to workspace resources. Invitations,
          administrative actions and restricted data have additional permission checks.
          Administrators should regularly review access and remove people who no longer need it.
        </p>
      </section>
      <section>
        <h2>Files and integrations</h2>
        <p>
          File access is authorized through the API and uses private storage with temporary access
          URLs. Meetings, messaging and office editing depend on configured external providers.
          Operators must maintain provider credentials, storage permissions and integration settings
          appropriately.
        </p>
      </section>
      <section>
        <h2>Operating securely</h2>
        <p>
          Production operators are responsible for HTTPS, infrastructure access, data protection
          settings, backups, recovery testing, updates and incident response. Availability,
          encryption at rest and hosting locations depend on deployment configuration. This page
          does not claim an audit, certification, penetration-test result or a guarantee of absolute
          security.
        </p>
      </section>
      <section>
        <h2>Raise a concern</h2>
        <p>
          If you suspect unauthorized access, contact your organization’s administrator through an
          established channel. See{" "}
          <Link className="text-primary underline" to="/contact">
            Contact Us
          </Link>{" "}
          for reporting guidance. Provide only the information needed to investigate, and avoid
          sharing credentials or other people’s personal information.
        </p>
      </section>
    </PublicPage>
  );
}
