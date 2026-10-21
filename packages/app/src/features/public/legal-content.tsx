import { legalVersions } from "@lumo/contracts/legal";
import { Link } from "@tanstack/react-router";

import { documents20261021 } from "./legal-documents/2026-10-21";

export type LegalDocument = keyof typeof documents20261021;
export const legalDocuments = documents20261021;
export const legalUpdated = "October 21, 2026";

export function LegalContent({ document }: { document: LegalDocument }) {
  const content = legalDocuments[document];
  return (
    <div className="grid min-w-0 gap-6 text-sm leading-7 break-words">
      <p className="rounded-lg border bg-muted/40 px-4 py-3 text-xs leading-5">
        Draft for legal review · Version {legalVersions[document]} · Last updated {legalUpdated}.
        Review the operator details and deployment practices before public launch.
      </p>
      {content.sections.map((section, index) => (
        <section key={section.title} className="grid gap-2">
          <h2 className="text-base font-semibold">
            {index + 1}. {section.title}
          </h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
      <p>
        Questions?{" "}
        <Link className="text-primary underline underline-offset-4" to="/contact">
          Contact Us
        </Link>
        .
      </p>
      {document === "privacy" && (
        <p className="text-xs">
          References:{" "}
          <a
            className="underline"
            href="https://privacy.gov.ph/data-privacy-act-/"
            target="_blank"
            rel="noreferrer"
          >
            Data Privacy Act of 2012
          </a>
          ,{" "}
          <a
            className="underline"
            href="https://privacy.gov.ph/data-subject-rights/"
            target="_blank"
            rel="noreferrer"
          >
            NPC data subject rights
          </a>
          .
        </p>
      )}
    </div>
  );
}
