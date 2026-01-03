import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to get authenticated user ID from Clerk JWT
async function getAuthUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

export const createScript = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.string(),
    style: v.string(),
    narratorVoice: v.optional(v.string()),
    characters: v.optional(v.string()), // JSON string of Character[]
    scenes: v.array(
      v.object({
        sceneNumber: v.number(),
        timeRange: v.string(),
        visualDescription: v.string(),
        audioDescription: v.string(),
        cameraShot: v.string(),
        voiceoverText: v.string(),
        dialogue: v.optional(v.string()), // JSON string of DialogueLine[]
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    const now = Date.now();

    // Create script
    const scriptId = await ctx.db.insert("scripts", {
      projectId: args.projectId,
      title: args.title,
      style: args.style,
      narratorVoice: args.narratorVoice,
      characters: args.characters,
      createdAt: now,
    });

    // Create all scenes
    const sceneIds: string[] = [];
    for (const scene of args.scenes) {
      const sceneId = await ctx.db.insert("scenes", {
        scriptId,
        projectId: args.projectId,
        ...scene,
        createdAt: now,
      });
      sceneIds.push(sceneId);
    }

    // Update project status
    await ctx.db.patch(args.projectId, {
      title: args.title,
      style: args.style,
      status: "storyboarding",
      updatedAt: now,
    });

    return { scriptId, sceneIds };
  },
});

export const getScript = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      return null;
    }

    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .order("desc")
      .first();

    return scripts;
  },
});

export const getScenesByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      return [];
    }

    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();

    return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
  },
});

export const getScenesByScript = query({
  args: { scriptId: v.id("scripts") },
  handler: async (ctx, { scriptId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_script", (q) => q.eq("scriptId", scriptId))
      .collect();

    return scenes.sort((a, b) => a.sceneNumber - b.sceneNumber);
  },
});
