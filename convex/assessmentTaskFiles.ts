import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAssessmentEdit, requireAssessmentRead } from "./lib/access";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES_PER_TASK = 40;
const MAX_FILES_PER_NOTE = 10;

const ALLOWED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
  "pdf",
  "txt",
  "md",
  "csv",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "odp",
  "rtf",
  "json",
  "xml",
  "zip",
]);

const ALLOWED_MIME_PREFIXES = [
  "image/",
  "text/",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument",
  "application/rtf",
  "application/json",
  "application/xml",
  "application/zip",
  "application/x-zip-compressed",
];

type StorageMeta = {
  _id: Id<"_storage">;
  size: number;
  contentType?: string;
};

function extOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  if (i < 0) return "";
  return fileName.slice(i + 1).toLowerCase();
}

function isAllowedFile(fileName: string, contentType: string): boolean {
  const ext = extOf(fileName);
  if (ext && ALLOWED_EXTENSIONS.has(ext)) return true;
  const ct = contentType.toLowerCase();
  return ALLOWED_MIME_PREFIXES.some(
    (p) => ct === p || (p.endsWith("/") && ct.startsWith(p)),
  );
}

const fileDto = v.object({
  _id: v.id("assessmentTaskFiles"),
  taskId: v.id("assessmentTasks"),
  noteId: v.union(v.id("assessmentTaskNotes"), v.null()),
  fileName: v.string(),
  contentType: v.string(),
  sizeBytes: v.number(),
  url: v.union(v.string(), v.null()),
  uploadedByUserId: v.id("users"),
  uploaderName: v.string(),
  createdAt: v.number(),
  isImage: v.boolean(),
});

export const generateUploadUrl = mutation({
  args: { taskId: v.id("assessmentTasks") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Fant ikke saken.");
    await requireAssessmentEdit(ctx, task.assessmentId);
    return await ctx.storage.generateUploadUrl();
  },
});

export const attach = mutation({
  args: {
    taskId: v.id("assessmentTasks"),
    noteId: v.optional(v.id("assessmentTaskNotes")),
    storageId: v.id("_storage"),
    fileName: v.string(),
  },
  returns: v.id("assessmentTaskFiles"),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Fant ikke saken.");
    const { assessment, userId } = await requireAssessmentEdit(
      ctx,
      task.assessmentId,
    );

    const fileName = args.fileName.trim().slice(0, 180);
    if (!fileName) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Filnavn mangler.");
    }

    if (args.noteId) {
      const note = await ctx.db.get(args.noteId);
      if (!note || note.taskId !== args.taskId) {
        await ctx.storage.delete(args.storageId);
        throw new Error("Kommentaren finnes ikke på denne saken.");
      }
      const noteFiles = await ctx.db
        .query("assessmentTaskFiles")
        .withIndex("by_note", (q) => q.eq("noteId", args.noteId!))
        .collect();
      if (noteFiles.length >= MAX_FILES_PER_NOTE) {
        await ctx.storage.delete(args.storageId);
        throw new Error(
          `Maks ${MAX_FILES_PER_NOTE} filer per kommentar.`,
        );
      }
    }

    const existing = await ctx.db
      .query("assessmentTaskFiles")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    if (existing.length >= MAX_FILES_PER_TASK) {
      await ctx.storage.delete(args.storageId);
      throw new Error(`Maks ${MAX_FILES_PER_TASK} filer per kort.`);
    }

    const meta = (await ctx.db.system.get(
      "_storage",
      args.storageId,
    )) as StorageMeta | null;
    if (!meta) throw new Error("Filen finnes ikke.");
    if (meta.size > MAX_FILE_BYTES) {
      await ctx.storage.delete(args.storageId);
      throw new Error("Filen er for stor (maks 15 MB).");
    }
    const contentType = meta.contentType ?? "application/octet-stream";
    if (!isAllowedFile(fileName, contentType)) {
      await ctx.storage.delete(args.storageId);
      throw new Error(
        "Filtypen støttes ikke. Bruk f.eks. bilde, PDF, Word, Excel eller tekst.",
      );
    }

    return await ctx.db.insert("assessmentTaskFiles", {
      workspaceId: assessment.workspaceId,
      taskId: args.taskId,
      noteId: args.noteId,
      storageId: args.storageId,
      fileName,
      contentType,
      sizeBytes: meta.size,
      uploadedByUserId: userId,
      createdAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { fileId: v.id("assessmentTaskFiles") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.fileId);
    if (!row) return null;
    const task = await ctx.db.get(row.taskId);
    if (!task) {
      await ctx.db.delete(args.fileId);
      await ctx.storage.delete(row.storageId);
      return null;
    }
    const { userId } = await requireAssessmentEdit(ctx, task.assessmentId);
    // Uploader or anyone with edit can remove
    void userId;
    await ctx.db.delete(args.fileId);
    await ctx.storage.delete(row.storageId);
    return null;
  },
});

export const listByTask = query({
  args: { taskId: v.id("assessmentTasks") },
  returns: v.array(fileDto),
  handler: async (ctx, args) => {
    const task = await ctx.db.get(args.taskId);
    if (!task) return [];
    await requireAssessmentRead(ctx, task.assessmentId);
    const rows = await ctx.db
      .query("assessmentTaskFiles")
      .withIndex("by_task", (q) => q.eq("taskId", args.taskId))
      .collect();
    rows.sort((a, b) => a.createdAt - b.createdAt);
    const out = [];
    for (const r of rows) {
      const u = await ctx.db.get(r.uploadedByUserId);
      const url = await ctx.storage.getUrl(r.storageId);
      out.push({
        _id: r._id,
        taskId: r.taskId,
        noteId: r.noteId ?? null,
        fileName: r.fileName,
        contentType: r.contentType,
        sizeBytes: r.sizeBytes,
        url,
        uploadedByUserId: r.uploadedByUserId,
        uploaderName: u?.name?.trim() || u?.email || "Bruker",
        createdAt: r.createdAt,
        isImage: r.contentType.startsWith("image/"),
      });
    }
    return out;
  },
});
