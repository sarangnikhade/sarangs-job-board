"use client";

import { AddJobDialog } from "./AddJobDialog";
import { useApp } from "@/lib/store";

/**
 * App-level mount point for the Add Job dialog.
 * Lives in the root layout so the TopNav button can open it from
 * any page without prop-drilling.
 */
export function AddJobLauncher() {
  const open = useApp((s) => s.addJobOpen);
  const setOpen = useApp((s) => s.setAddJob);
  const bump = useApp((s) => s.bumpJobs);

  return (
    <AddJobDialog open={open} onOpenChange={setOpen} onCreated={bump} />
  );
}
