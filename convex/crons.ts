import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "compliance email reminders",
  { hours: 168 },
  internal.reminders.runComplianceReminders,
  {},
);

crons.interval(
  "review due email reminders",
  { hours: 24 },
  internal.reminders.runReviewDueReminders,
  {},
);

crons.interval(
  "weekly open assessments digest",
  { hours: 168 },
  internal.weeklyDraftDigest.runWeeklyDraftDigest,
  {},
);

export default crons;
