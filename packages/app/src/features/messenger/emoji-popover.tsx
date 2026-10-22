import { Button, Loading, Popover, PopoverContent, PopoverTrigger, ErrorMessage } from "@lumo/ui";
import { SmilePlus } from "lucide-react";
import { Component, lazy, Suspense, useState, type ReactNode } from "react";

// Data and keyboard engine load only when a picker is opened. Native glyphs avoid remote assets.
const Picker = lazy(() => import("emoji-picker-react"));
class PickerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <ErrorMessage
        error={new Error("Emoji picker could not load. Refresh the page and try again.")}
      />
    ) : (
      this.props.children
    );
  }
}
export function EmojiPopover({
  label,
  disabled,
  onPick,
  returnFocus,
}: {
  label: string;
  disabled?: boolean;
  onPick: (emoji: string) => void;
  returnFocus?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" aria-label={label} title={label} disabled={disabled}>
          <SmilePlus aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        className="w-[min(352px,calc(100vw-24px))] p-0"
        aria-label={label}
        onCloseAutoFocus={(event) => {
          if (returnFocus) {
            event.preventDefault();
            returnFocus();
          }
        }}
      >
        <PickerBoundary>
          <Suspense fallback={<Loading label="Loading emoji…" />}>
            <Picker
              width="100%"
              height={360}
              emojiStyle="native"
              theme={document.documentElement.dataset.theme === "dark" ? "dark" : "light"}
              className="lumo-emoji-picker"
              autoFocusSearch
              keepSearchFocus
              lazyLoadEmojis
              previewConfig={{ showPreview: false }}
              onEmojiClick={(data) => {
                onPick(data.emoji);
                setOpen(false);
              }}
            />
          </Suspense>
        </PickerBoundary>
      </PopoverContent>
    </Popover>
  );
}
