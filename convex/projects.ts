import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Helper to get authenticated user ID from Clerk JWT
async function getAuthUserId(ctx: { auth: { getUserIdentity: () => Promise<{ subject: string } | null> } }) {
  const identity = await ctx.auth.getUserIdentity();
  return identity?.subject ?? null;
}

export const create = mutation({
  args: {
    title: v.string(),
    style: v.string(),
    originalPrompt: v.string(),
    aspectRatio: v.union(v.literal("16:9"), v.literal("9:16")),
    videoModel: v.union(v.literal("veo-3.1"), v.literal("seedance-1.5")),
    enableCuts: v.boolean(),
    seedanceAudio: v.boolean(),
    seedanceResolution: v.union(v.literal("480p"), v.literal("720p")),
    seedanceDuration: v.optional(v.union(v.literal(4), v.literal(8), v.literal(12))),
    seedanceSceneCount: v.union(v.literal(9), v.literal(15)),
    voiceMode: v.optional(v.union(v.literal("tts"), v.literal("speech_in_video"))),
    multiCharacter: v.optional(v.boolean()),
    language: v.optional(v.string()),
    backgroundMusicEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const now = Date.now();
    return await ctx.db.insert("projects", {
      userId,
      ...args,
      voiceMode: args.voiceMode ?? "tts",
      multiCharacter: args.multiCharacter ?? false,
      language: args.language ?? "english",
      backgroundMusicEnabled: args.backgroundMusicEnabled ?? true,
      seedanceDuration: args.seedanceDuration ?? 4,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const projects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    // Fetch thumbnail for each project (first storyboard or first frame)
    const projectsWithThumbnails = await Promise.all(
      projects.map(async (project) => {
        const storyboard = await ctx.db
          .query("storyboards")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .first();

        const frame = !storyboard ? await ctx.db
          .query("frames")
          .withIndex("by_project", (q) => q.eq("projectId", project._id))
          .first() : null;

        return {
          ...project,
          thumbnailUrl: storyboard?.imageUrl ?? frame?.imageUrl ?? null,
        };
      })
    );

    return projectsWithThumbnails;
  },
});

export const get = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      return null;
    }
    return project;
  },
});

export const updateStatus = mutation({
  args: {
    projectId: v.id("projects"),
    status: v.union(
      v.literal("draft"),
      v.literal("scripting"),
      v.literal("storyboarding"),
      v.literal("production"),
      v.literal("completed")
    ),
  },
  handler: async (ctx, { projectId, status }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    await ctx.db.patch(projectId, {
      status,
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    projectId: v.id("projects"),
    title: v.optional(v.string()),
    style: v.optional(v.string()),
    originalPrompt: v.optional(v.string()),
    characterRefs: v.optional(v.string()),
    aspectRatio: v.optional(v.union(v.literal("16:9"), v.literal("9:16"))),
    videoModel: v.optional(v.union(v.literal("veo-3.1"), v.literal("seedance-1.5"))),
    enableCuts: v.optional(v.boolean()),
    seedanceAudio: v.optional(v.boolean()),
    seedanceResolution: v.optional(v.union(v.literal("480p"), v.literal("720p"))),
    seedanceDuration: v.optional(v.union(v.literal(4), v.literal(8), v.literal(12))),
    seedanceSceneCount: v.optional(v.union(v.literal(9), v.literal(15))),
    voiceMode: v.optional(v.union(v.literal("tts"), v.literal("speech_in_video"))),
    multiCharacter: v.optional(v.boolean()),
    language: v.optional(v.string()),
    backgroundMusicEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { projectId, ...updates }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    // Filter out undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(projectId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { projectId: v.id("projects") },
  handler: async (ctx, { projectId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");

    const project = await ctx.db.get(projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found");
    }

    // Delete all related data
    const scripts = await ctx.db
      .query("scripts")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const script of scripts) {
      await ctx.db.delete(script._id);
    }

    const scenes = await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const scene of scenes) {
      await ctx.db.delete(scene._id);
    }

    const storyboards = await ctx.db
      .query("storyboards")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const sb of storyboards) {
      await ctx.db.delete(sb._id);
    }

    const frames = await ctx.db
      .query("frames")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const frame of frames) {
      await ctx.db.delete(frame._id);
    }

    const videos = await ctx.db
      .query("videos")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const video of videos) {
      await ctx.db.delete(video._id);
    }

    const audioTracks = await ctx.db
      .query("audioTracks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const audio of audioTracks) {
      await ctx.db.delete(audio._id);
    }

    const tasks = await ctx.db
      .query("generationTasks")
      .withIndex("by_project", (q) => q.eq("projectId", projectId))
      .collect();
    for (const task of tasks) {
      await ctx.db.delete(task._id);
    }

    await ctx.db.delete(projectId);
  },
});
