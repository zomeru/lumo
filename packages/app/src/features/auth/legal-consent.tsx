import { legalVersions } from "@lumo/contracts/legal";
import {
  Button,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@lumo/ui";
import { useCallback, useState } from "react";

import { LegalContent, legalDocuments, type LegalDocument } from "../public/legal-content";

function LegalReader({
  document,
  reviewed,
  onReview,
}: {
  document: LegalDocument;
  reviewed: boolean;
  onReview: () => void;
}) {
  const [reachedEnd, setReachedEnd] = useState(reviewed);
  const viewport = useCallback((element: HTMLElement | null) => {
    if (!element) return;
    function checkEnd() {
      if (
        element &&
        element.clientHeight > 0 &&
        element.scrollHeight - element.scrollTop - element.clientHeight <= 2
      )
        setReachedEnd(true);
    }
    checkEnd();
    const observer = new ResizeObserver(checkEnd);
    observer.observe(element);
    const content = element.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, []);
  return (
    <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
      <DialogTitle>{legalDocuments[document].title}</DialogTitle>
      <DialogDescription>
        Version {legalVersions[document]}. Read to the end, then acknowledge this document.
      </DialogDescription>
      <section
        ref={viewport}
        aria-label={`${legalDocuments[document].title} document`}
        // Keyboard users need to focus the document to scroll with Page Down / End.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex
        tabIndex={0}
        className="min-h-0 overflow-y-auto overscroll-contain rounded-md border p-4 focus-visible:outline-2 focus-visible:outline-ring"
        onScroll={(event) => {
          const element = event.currentTarget;
          if (
            element.clientHeight > 0 &&
            element.scrollHeight - element.scrollTop - element.clientHeight <= 2
          )
            setReachedEnd(true);
        }}
      >
        <LegalContent document={document} />
      </section>
      <output className="text-xs text-muted-foreground">
        {reviewed
          ? "You have already acknowledged this version."
          : reachedEnd
            ? "You’ve reached the end. You can now acknowledge this document."
            : "Scroll to the bottom to enable acknowledgement."}
      </output>
      <div className="flex justify-end">
        <DialogClose asChild>
          <Button variant="primary" disabled={!reachedEnd} onClick={onReview}>
            {reviewed ? "Done" : "Acknowledge document"}
          </Button>
        </DialogClose>
      </div>
    </DialogContent>
  );
}

function LegalReview({
  document,
  reviewed,
  onReview,
}: {
  document: LegalDocument;
  reviewed: boolean;
  onReview: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <a
          href={`/${document}`}
          onClick={(event) => {
            event.preventDefault();
            setOpen(true);
          }}
          className="rounded-sm text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
        >
          {legalDocuments[document].title}
        </a>
      </DialogTrigger>
      {open && <LegalReader document={document} reviewed={reviewed} onReview={onReview} />}
    </Dialog>
  );
}

export function LegalConsent({
  reviewed,
  onReview,
  accepted,
  onAcceptedChange,
}: {
  reviewed: Record<LegalDocument, boolean>;
  onReview: (document: LegalDocument) => void;
  accepted: boolean;
  onAcceptedChange: (value: boolean) => void;
}) {
  const ready = reviewed.terms && reviewed.privacy;
  return (
    <div className="grid gap-2">
      <div className="flex items-start gap-2.5">
        <Checkbox
          id="legal-agreement"
          required
          checked={accepted}
          disabled={!ready}
          onCheckedChange={(value) => onAcceptedChange(value === true)}
          aria-labelledby="legal-agreement-label"
          aria-describedby="legal-review-progress"
          className="mt-1"
        />
        <div id="legal-agreement-label" className="text-xs leading-6">
          <label htmlFor="legal-agreement">I have read and agree to the </label>
          <LegalReview
            document="terms"
            reviewed={reviewed.terms}
            onReview={() => onReview("terms")}
          />
          {" and "}
          <LegalReview
            document="privacy"
            reviewed={reviewed.privacy}
            onReview={() => onReview("privacy")}
          />
          .
        </div>
      </div>
      <output id="legal-review-progress" className="text-xs leading-5 text-muted-foreground">
        {accepted
          ? "Both documents acknowledged. Agreement confirmed."
          : ready
            ? "Both documents acknowledged. Check the agreement to continue."
            : `Open and acknowledge both documents first. Terms: ${reviewed.terms ? "reviewed" : "not reviewed"}. Privacy: ${reviewed.privacy ? "reviewed" : "not reviewed"}.`}
      </output>
    </div>
  );
}
