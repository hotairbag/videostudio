import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to get authenticated user ID from Clerk JWT
async function getAuthUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

export const createMany = mutation({
  args: {
    projectId: v.id("projects"),
    frames: v.array(
      v.object({
        sceneId: v.id("scenes"),
        frameNumber: v.number(),
        imageUrl: v.string(),
      })
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
    const frameIds: string[] = [];

    for (const frame of args.frames) {
      const frameId = await ctx.db.insert("frames", {
        projectId: args.projectId,
        ...frame,
        createdAt: now,
      });
      frameIds.push(frameId);
    }

    return frameIds;
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

    const frames = await ctx.db
      .query("frames")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return frames.sort((a, b) => a.frameNumber - b.frameNumber);
  },
});

export const getByScene = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, { sceneId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const frame = await ctx.db
      .query("frames")
      .withIndex("by_scene", (q) => q.eq("sceneId", sceneId))
      .first();

    if (!frame) return null;

    const project = await ctx.db.get(frame.projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    return frame;
  },
});
