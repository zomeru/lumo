import { createFileRoute } from "@tanstack/react-router";

import { MeetingPage } from "../features/meetings/meetings-page";
export const Route = createFileRoute("/_authenticated/meetings/$meetingId")({
  component: function Page() {
    return <MeetingPage meetingId={Route.useParams().meetingId} />;
  },
});
