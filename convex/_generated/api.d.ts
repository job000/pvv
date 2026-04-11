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
import type * as githubProjectColumnItems from "../githubProjectColumnItems.js";
import type * as githubTasks from "../githubTasks.js";
import type * as http from "../http.js";
import type * as intakeEmails from "../intakeEmails.js";
import type * as intakeForms from "../intakeForms.js";
import type * as intakeLinks from "../intakeLinks.js";
import type * as intakeSubmissions from "../intakeSubmissions.js";
import type * as lib_access from "../lib/access.js";
import type * as lib_assessmentCreation from "../lib/assessmentCreation.js";
import type * as lib_cascadeDeletePvv from "../lib/cascadeDeletePvv.js";
import type * as lib_emailHtml from "../lib/emailHtml.js";
import type * as lib_github from "../lib/github.js";
import type * as lib_githubCandidateSync from "../lib/githubCandidateSync.js";
import type * as lib_githubGraphql from "../lib/githubGraphql.js";
import type * as lib_githubSubIssues from "../lib/githubSubIssues.js";
import type * as lib_intakeDerivedIds from "../lib/intakeDerivedIds.js";
import type * as lib_intakeGithubOccupiedRefs from "../lib/intakeGithubOccupiedRefs.js";
import type * as lib_intakeMapping from "../lib/intakeMapping.js";
import type * as lib_intakePublicScreening from "../lib/intakePublicScreening.js";
import type * as lib_intakePublicSecurity from "../lib/intakePublicSecurity.js";
import type * as lib_intakeSubmissionGithubBody from "../lib/intakeSubmissionGithubBody.js";
import type * as lib_payloadSnapshot from "../lib/payloadSnapshot.js";
import type * as lib_rosIntakePlacement from "../lib/rosIntakePlacement.js";
import type * as lib_rpaScoring from "../lib/rpaScoring.js";
import type * as lib_userSearch from "../lib/userSearch.js";
import type * as notificationEmailInternal from "../notificationEmailInternal.js";
import type * as notificationEmails from "../notificationEmails.js";
import type * as orgUnits from "../orgUnits.js";
import type * as processDesignDocs from "../processDesignDocs.js";
import type * as reminderInternal from "../reminderInternal.js";
import type * as reminders from "../reminders.js";
import type * as reviewSchedule from "../reviewSchedule.js";
import type * as ros from "../ros.js";
import type * as rosAxisLists from "../rosAxisLists.js";
import type * as rosLibrary from "../rosLibrary.js";
import type * as superAdmin from "../superAdmin.js";
import type * as userInAppNotifications from "../userInAppNotifications.js";
import type * as users from "../users.js";
import type * as weeklyDigestInternal from "../weeklyDigestInternal.js";
import type * as weeklyDraftDigest from "../weeklyDraftDigest.js";
import type * as workspaceViewPrefs from "../workspaceViewPrefs.js";
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
  githubProjectColumnItems: typeof githubProjectColumnItems;
  githubTasks: typeof githubTasks;
  http: typeof http;
  intakeEmails: typeof intakeEmails;
  intakeForms: typeof intakeForms;
  intakeLinks: typeof intakeLinks;
  intakeSubmissions: typeof intakeSubmissions;
  "lib/access": typeof lib_access;
  "lib/assessmentCreation": typeof lib_assessmentCreation;
  "lib/cascadeDeletePvv": typeof lib_cascadeDeletePvv;
  "lib/emailHtml": typeof lib_emailHtml;
  "lib/github": typeof lib_github;
  "lib/githubCandidateSync": typeof lib_githubCandidateSync;
  "lib/githubGraphql": typeof lib_githubGraphql;
  "lib/githubSubIssues": typeof lib_githubSubIssues;
  "lib/intakeDerivedIds": typeof lib_intakeDerivedIds;
  "lib/intakeGithubOccupiedRefs": typeof lib_intakeGithubOccupiedRefs;
  "lib/intakeMapping": typeof lib_intakeMapping;
  "lib/intakePublicScreening": typeof lib_intakePublicScreening;
  "lib/intakePublicSecurity": typeof lib_intakePublicSecurity;
  "lib/intakeSubmissionGithubBody": typeof lib_intakeSubmissionGithubBody;
  "lib/payloadSnapshot": typeof lib_payloadSnapshot;
  "lib/rosIntakePlacement": typeof lib_rosIntakePlacement;
  "lib/rpaScoring": typeof lib_rpaScoring;
  "lib/userSearch": typeof lib_userSearch;
  notificationEmailInternal: typeof notificationEmailInternal;
  notificationEmails: typeof notificationEmails;
  orgUnits: typeof orgUnits;
  processDesignDocs: typeof processDesignDocs;
  reminderInternal: typeof reminderInternal;
  reminders: typeof reminders;
  reviewSchedule: typeof reviewSchedule;
  ros: typeof ros;
  rosAxisLists: typeof rosAxisLists;
  rosLibrary: typeof rosLibrary;
  superAdmin: typeof superAdmin;
  userInAppNotifications: typeof userInAppNotifications;
  users: typeof users;
  weeklyDigestInternal: typeof weeklyDigestInternal;
  weeklyDraftDigest: typeof weeklyDraftDigest;
  workspaceViewPrefs: typeof workspaceViewPrefs;
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
