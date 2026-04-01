import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { requireUserId } from "./lib/access";

const MAX_NAME = 120;
const MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024;

type FileMetadataRow = {
  _id: Id<"_storage">;
  contentType?: string;
  size: number;
};

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}

export const getMyProfile = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    let profileImageUrl: string | null = null;
    const pid = settings?.profileImageId;
    if (pid) {
      profileImageUrl = await ctx.storage.getUrl(pid);
    }
    return { user, settings, profileImageUrl };
  },
});

export const patchMyUserSettings = mutation({
  args: {
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    age: v.optional(v.union(v.number(), v.null())),
    themePreference: v.optional(
      v.union(
        v.literal("light"),
        v.literal("dark"),
        v.literal("system"),
      ),
    ),
    uiDensity: v.optional(
      v.union(v.literal("comfortable"), v.literal("compact")),
    ),
    prosessregisterTutorialEnabled: v.optional(v.boolean()),
    appEntryPreference: v.optional(
      v.union(v.literal("dashboard"), v.literal("workspace")),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const patch: Record<string, unknown> = {};

    if (args.firstName !== undefined) {
      const t = args.firstName.trim();
      patch.firstName = t.length > 0 ? t.slice(0, MAX_NAME) : undefined;
    }
    if (args.lastName !== undefined) {
      const t = args.lastName.trim();
      patch.lastName = t.length > 0 ? t.slice(0, MAX_NAME) : undefined;
    }
    if (args.age !== undefined) {
      if (args.age === null) {
        patch.age = null;
      } else {
        if (!Number.isInteger(args.age) || args.age < 0 || args.age > 120) {
          throw new Error("Alder må være et heltall mellom 0 og 120.");
        }
        patch.age = args.age;
      }
    }
    if (args.themePreference !== undefined) {
      patch.themePreference = args.themePreference;
    }
    if (args.uiDensity !== undefined) {
      patch.uiDensity = args.uiDensity;
    }
    if (args.prosessregisterTutorialEnabled !== undefined) {
      patch.prosessregisterTutorialEnabled = args.prosessregisterTutorialEnabled;
      if (args.prosessregisterTutorialEnabled) {
        patch.prosessregisterTutorialDismissed = false;
      }
    }
    if (args.appEntryPreference !== undefined) {
      patch.appEntryPreference = args.appEntryPreference;
    }

    const clean = omitUndefined(patch);

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, clean);
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        ...clean,
      });
    }

    const after = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    const fn = after?.firstName?.trim() ?? "";
    const ln = after?.lastName?.trim() ?? "";
    const combined = `${fn} ${ln}`.trim();
    if (combined.length > 0) {
      await ctx.db.patch(userId, { name: combined.slice(0, 240) });
    }

    return null;
  },
});

/** Kortlivet URL for direkte opplasting av profilbilde til Convex storage. */
export const generateProfileImageUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUserId(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const setMyProfileImage = mutation({
  args: {
    storageId: v.optional(v.id("_storage")),
    clear: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const existing = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const oldId = existing?.profileImageId;

    if (args.clear === true) {
      if (oldId) {
        await ctx.storage.delete(oldId);
      }
      if (existing) {
        await ctx.db.patch(existing._id, { profileImageId: null });
      }
      return null;
    }

    if (!args.storageId) {
      throw new Error("Mangler storageId eller clear.");
    }

    const meta = (await ctx.db.system.get(
      "_storage",
      args.storageId,
    )) as FileMetadataRow | null;
    if (!meta) {
      throw new Error("Filen finnes ikke.");
    }
    if (meta.size > MAX_PROFILE_IMAGE_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Bildet er for stort (maks 5 MB).");
    }
    const ct = meta.contentType ?? "";
    if (!ct.startsWith("image/")) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Kun bildefiler er tillatt.");
    }

    if (oldId && oldId !== args.storageId) {
      await ctx.storage.delete(oldId);
    }

    if (existing) {
      await ctx.db.patch(existing._id, { profileImageId: args.storageId });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        profileImageId: args.storageId,
      });
    }
    return null;
  },
});
