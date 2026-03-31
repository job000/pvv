import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "compliance email reminders",
  { hours: 168 },
  internal.reminders.runComplianceReminders,
  {},
);

export default crons;
