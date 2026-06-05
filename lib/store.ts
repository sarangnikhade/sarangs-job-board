"use client";
import { create } from "zustand";

/**
 * Cross-component UI state.
 * - addJobOpen: controls the Add Job dialog
 * - jobsVersion: bumped after a job is created/updated/deleted so the
 *   board list can refetch without prop-drilling.
 */
type State = {
  addJobOpen: boolean;
  openJobId: number | null;
  jobsVersion: number;
  openAddJob: () => void;
  setAddJob: (v: boolean) => void;
  openJob: (id: number) => void;
  closeJob: () => void;
  bumpJobs: () => void;
};

export const useApp = create<State>((set) => ({
  addJobOpen: false,
  openJobId: null,
  jobsVersion: 0,
  openAddJob: () => set({ addJobOpen: true }),
  setAddJob: (v) => set({ addJobOpen: v }),
  openJob: (id) => set({ openJobId: id }),
  closeJob: () => set({ openJobId: null }),
  bumpJobs: () => set((s) => ({ jobsVersion: s.jobsVersion + 1 })),
}));
