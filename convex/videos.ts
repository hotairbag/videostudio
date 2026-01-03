import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to get authenticated user ID from Clerk JWT
async function getAuthUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

export const create = mutation({
  args: {
    projectId: v.id("projects"),
    sceneId: v.id("scenes"),
    videoUrl: v.string(),
    duration: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    const now = Date.now();
    return await ctx.db.insert("videos", {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      return [];
    }

    return await ctx.db
      .query("videos")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const getByScene = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const video = await ctx.db
      .query("videos")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .first();

    if (!video) return null;

    const project = await ctx.db.get(video.projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    return video;
  },
});

export const updateStatus = mutation({
  args: {
    videoId: v.id("videos"),
    status: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("completed"),
      v.literal("failed")
    ),
    videoUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { videoId, status, videoUrl, errorMessage }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const video = await ctx.db.get(videoId);
    if (!video) throw new Error("Video not found");

    const project = await ctx.db.get(video.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(videoId, {
      status,
      ...(videoUrl && { videoUrl }),
      ...(errorMessage && { errorMessage }),
      updatedAt: Date.now(),
    });
  },
});

export const getCompletedCount = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return 0;

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      return 0;
    }

    const videos = await ctx.db
      .query("videos")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return videos.filter((v) => v.status === "completed").length;
  },
});
