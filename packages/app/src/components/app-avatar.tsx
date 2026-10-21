import { avatarIdentity, avatarUrlSchema } from "@lumo/contracts/avatar";
import { Avatar } from "@lumo/ui";
import { useQuery } from "@tanstack/react-query";
import type { ComponentProps } from "react";

import { api } from "../lib/api";
/** Resolve private storage through the authenticated transport, including Electron IPC. */
export function AppAvatar({ src, ...props }: ComponentProps<typeof Avatar>) {
  const identity = avatarIdentity(src);
  const photo = useQuery({
    queryKey: ["avatar", src],
    enabled: Boolean(identity),
    queryFn: ({ signal }) =>
      api(`/avatars/${identity!.userId}/${identity!.version}`, avatarUrlSchema, { signal }),
    staleTime: 60000,
    refetchInterval: 90000,
    retry: false,
  });
  return <Avatar {...props} src={identity ? photo.data?.url : src} />;
}
