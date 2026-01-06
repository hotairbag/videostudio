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

    // Delete existing scripts and scenes for this project (clean slate on regenerate)
    const existingScripts = await ctx.db
      .query("scripts")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const existingScript of existingScripts) {
      // Delete scenes for this script
      const existingScenes = await ctx.db
        .query("scenes")
        .withIndex("by_script", (q) => q.eq("scriptId", existingScript._id))
        .collect();
      for (const scene of existingScenes) {
        await ctx.db.delete(scene._id);
      }
      // Delete the script
      await ctx.db.delete(existingScript._id);
    }

    // Also delete any orphaned scenes for this project (safety cleanup)
    const orphanedScenes = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();
    for (const scene of orphanedScenes) {
      await ctx.db.delete(scene._id);
    }

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

// Cleanup mutation to remove duplicate scenes from a project
// Keeps only the most recent scene for each sceneNumber
export const cleanupDuplicateScenes = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    return await cleanupDuplicateScenesInternal(ctx, projectId);
  },
});

// Internal cleanup (for admin/CLI use)
export const cleanupDuplicateScenesAdmin = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const project = await ctx.db.get(projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    return await cleanupDuplicateScenesInternal(ctx, projectId);
  },
});

// Shared cleanup logic
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function cleanupDuplicateScenesInternal(ctx: any, projectId: any) {
  // Get all scenes for this project
  const allScenes = await ctx.db
    .query("scenes")
    .withIndex("by_project", (q: any) => q.eq("projectId", projectId))
    .collect();

  // Group by sceneNumber
  const scenesByNumber = new Map<number, typeof allScenes>();
  for (const scene of allScenes) {
    const existing = scenesByNumber.get(scene.sceneNumber) || [];
    existing.push(scene);
    scenesByNumber.set(scene.sceneNumber, existing);
  }

  // For each sceneNumber, keep the most recent (by createdAt), delete the rest
  let deletedCount = 0;
  for (const [, scenes] of scenesByNumber) {
    if (scenes.length > 1) {
      // Sort by createdAt descending, keep the first (newest)
      scenes.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));
      const toDelete = scenes.slice(1); // All except the newest
      for (const scene of toDelete) {
        await ctx.db.delete(scene._id);
        deletedCount++;
      }
    }
  }

  return { deletedCount, remainingScenes: allScenes.length - deletedCount };
}
