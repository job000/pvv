"use client";

import { RosAxisListsPage } from "@/components/ros/ros-axis-lists-page";
import type { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function RosAxisListsRoute() {
  const params = useParams();
  const workspaceId = params.workspaceId as Id<"workspaces">;

  return <RosAxisListsPage workspaceId={workspaceId} />;
}
