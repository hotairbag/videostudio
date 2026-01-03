import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to get authenticated user ID from Clerk JWT
async function getAuthUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

export const createTask = mutation({
  args: {
    projectId: v.id("projects"),
    taskType: v.union(
      v.literal("video_seedance"),
      v.literal("video_veo"),
      v.literal("music_suno"),
      v.literal("audio_tts")
    ),
    externalTaskId: v.string(),
    sceneId: v.optional(v.id("scenes")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    const now = Date.now();
    return await ctx.db.insert("generationTasks", {
      ...args,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getPendingTasks = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      return [];
    }

    const tasks = await ctx.db
      .query("generationTasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return tasks.filter(
      (t) => t.status === "pending" || t.status === "processing"
    );
  },
});

export const getAllTasks = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      return [];
    }

    return await ctx.db
      .query("generationTasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const updateTaskStatus = mutation({
  args: {
    taskId: v.id("generationTasks"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    resultUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const task = await ctx.db.get(args.taskId);
    if (!task) throw new Error("Task not found");

    const project = await ctx.db.get(task.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.taskId, {
      status: args.status,
      resultUrl: args.resultUrl,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
      lastPolledAt: Date.now(),
    });
  },
});

export const getTaskByExternalId = query({
  args: { externalTaskId: v.string() },
  handler: async (ctx, { externalTaskId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const task = await ctx.db
      .query("generationTasks")
      .withIndex("by_external_task", (q) =>
        q.eq("externalTaskId", externalTaskId)
      )
      .first();

    if (!task) return null;

    const project = await ctx.db.get(task.projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    return task;
  },
});
