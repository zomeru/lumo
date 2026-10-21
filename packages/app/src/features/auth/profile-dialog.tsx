import { Button, Dialog, DialogContent, DialogDescription, DialogTitle } from "@lumo/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import {
  createContext,
  useContext,
  useRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { ProfileForm } from "./profile-page";
const ProfileContext = createContext<(trigger: HTMLElement) => void>(() => {});
export function ProfileProvider({ children }: { children: ReactNode }) {
  const trigger = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const search = useSearch({ from: "/_authenticated" });
  const navigate = useNavigate();
  return (
    <ProfileContext
      value={(element) => {
        trigger.current = element;
        setOpen(true);
      }}
    >
      {children}
      <Dialog
        open={open || Boolean(search.profile)}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value && search.profile)
            void navigate({
              to: ".",
              search: (previous) => ({ ...previous, profile: undefined }),
              replace: true,
            });
        }}
      >
        <DialogContent
          className="max-w-2xl"
          onCloseAutoFocus={(event) => {
            if (trigger.current?.isConnected) {
              event.preventDefault();
              trigger.current.focus();
            }
          }}
        >
          <DialogTitle>Your profile</DialogTitle>
          <DialogDescription>
            Manage your account and photo without leaving your workspace.
          </DialogDescription>
          <ProfileForm />
        </DialogContent>
      </Dialog>
    </ProfileContext>
  );
}
export function ProfileButton(props: ComponentProps<typeof Button>) {
  const open = useContext(ProfileContext);
  return (
    <Button
      {...props}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) open(event.currentTarget);
      }}
    />
  );
}
