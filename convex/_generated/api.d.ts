/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as assessmentNotes from "../assessmentNotes.js";
import type * as assessmentShareLinks from "../assessmentShareLinks.js";
import type * as assessmentTasks from "../assessmentTasks.js";
import type * as assessments from "../assessments.js";
import type * as auth from "../auth.js";
import type * as candidates from "../candidates.js";
import type * as crons from "../crons.js";
import type * as githubCandidateProject from "../githubCandidateProject.js";
import type * as githubIssueImport from "../githubIssueImport.js";
import type * as githubLeveranseSync from "../githubLeveranseSync.js";
import type * as githubProjectColumnItems from "../githubProjectColumnItems.js";
import type * as githubTasks from "../githubTasks.js";
import type * as http from "../http.js";
import type * as leveransePrefs from "../leveransePrefs.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_github from "../lib/github.js";
import type * as lib_githubCandidateSync from "../lib/githubCandidateSync.js";
import type * as lib_githubGraphql from "../lib/githubGraphql.js";
import type * as lib_githubSubIssues from "../lib/githubSubIssues.js";
import type * as lib_payloadSnapshot from "../lib/payloadSnapshot.js";
import type * as lib_rpaScoring from "../lib/rpaScoring.js";
import type * as orgUnits from "../orgUnits.js";
import type * as reminderInternal from "../reminderInternal.js";
import type * as reminders from "../reminders.js";
import type * as reviewSchedule from "../reviewSchedule.js";
import type * as ros from "../ros.js";
import type * as rosAxisLists from "../rosAxisLists.js";
import type * as sprints from "../sprints.js";
import type * as workspaces from "../workspaces.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  assessmentNotes: typeof assessmentNotes;
  assessmentShareLinks: typeof assessmentShareLinks;
  assessmentTasks: typeof assessmentTasks;
  assessments: typeof assessments;
  auth: typeof auth;
  candidates: typeof candidates;
  crons: typeof crons;
  githubCandidateProject: typeof githubCandidateProject;
  githubIssueImport: typeof githubIssueImport;
  githubLeveranseSync: typeof githubLeveranseSync;
  githubProjectColumnItems: typeof githubProjectColumnItems;
  githubTasks: typeof githubTasks;
  http: typeof http;
  leveransePrefs: typeof leveransePrefs;
  "lib/access": typeof lib_access;
  "lib/github": typeof lib_github;
  "lib/githubCandidateSync": typeof lib_githubCandidateSync;
  "lib/githubGraphql": typeof lib_githubGraphql;
  "lib/githubSubIssues": typeof lib_githubSubIssues;
  "lib/payloadSnapshot": typeof lib_payloadSnapshot;
  "lib/rpaScoring": typeof lib_rpaScoring;
  orgUnits: typeof orgUnits;
  reminderInternal: typeof reminderInternal;
  reminders: typeof reminders;
  reviewSchedule: typeof reviewSchedule;
  ros: typeof ros;
  rosAxisLists: typeof rosAxisLists;
  sprints: typeof sprints;
  workspaces: typeof workspaces;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
