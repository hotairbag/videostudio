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
    gridType: v.union(v.literal("3x3"), v.literal("3x2")),
    imageUrl: v.string(),
    seed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    const now = Date.now();
    return await ctx.db.insert("storyboards", {
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
      .query("storyboards")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
  },
});

export const update = mutation({
  args: {
    storyboardId: v.id("storyboards"),
    imageUrl: v.string(),
    seed: v.optional(v.number()),
  },
  handler: async (ctx, { storyboardId, imageUrl, seed }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const storyboard = await ctx.db.get(storyboardId);
    if (!storyboard) throw new Error("Storyboard not found");

    const project = await ctx.db.get(storyboard.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Unauthorized");
    }

    const updates: { imageUrl: string; seed?: number } = { imageUrl };
    if (seed !== undefined) {
      updates.seed = seed;
    }
    await ctx.db.patch(storyboardId, updates);
  },
});
