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
    type: v.union(v.literal("voiceover"), v.literal("music")),
    audioUrl: v.string(),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    const now = Date.now();
    return await ctx.db.insert("audioTracks", {
      ...args,
      createdAt: now,
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
      .query("audioTracks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const getByType = query({
  args: {
    projectId: v.id("projects"),
    type: v.union(v.literal("voiceover"), v.literal("music")),
  },
  handler: async (ctx, { projectId, type }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    return await ctx.db
      .query("audioTracks")
      .withIndex("by_project_type", (q) =>
        q.eq("projectId", projectId).eq("type", type)
      )
      .first();
  },
});

export const update = mutation({
  args: {
    audioId: v.id("audioTracks"),
    audioUrl: v.optional(v.string()),
    duration: v.optional(v.number()),
  },
  handler: async (ctx, { audioId, audioUrl, duration }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const audio = await ctx.db.get(audioId);
    if (!audio) throw new Error("Audio not found");

    const project = await ctx.db.get(audio.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(audioId, {
      ...(audioUrl && { audioUrl }),
      ...(duration && { duration }),
    });
  },
});
