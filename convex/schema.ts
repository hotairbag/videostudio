import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Projects - top level container for each video project
  // userId is a string from Clerk JWT subject claim
  projects: defineTable({
    userId: v.string(),
    title: v.string(),
    style: v.string(),
    originalPrompt: v.string(),
    // Character reference images (JSON array of {name: string, imageUrls: string[]})
    characterRefs: v.optional(v.string()),
    aspectRatio: v.union(v.literal("16:9"), v.literal("9:16")),
    videoModel: v.union(v.literal("veo-3.1"), v.literal("seedance-1.5")),
    enableCuts: v.boolean(),
    seedanceAudio: v.boolean(),
    seedanceResolution: v.union(v.literal("480p"), v.literal("720p")),
    seedanceDuration: v.optional(v.union(v.literal(4), v.literal(8), v.literal(12))),
    seedanceSceneCount: v.optional(v.union(v.literal(9), v.literal(15))),
    // Voice/dialogue settings
    voiceMode: v.optional(v.union(v.literal("tts"), v.literal("speech_in_video"))),
    multiCharacter: v.optional(v.boolean()),
    // Language for dialogue/text content (instructions stay in English)
    language: v.optional(v.string()), // e.g., "english", "japanese", "chinese", "korean", "spanish"
    // Whether to generate background music via Suno
    backgroundMusicEnabled: v.optional(v.boolean()),
    status: v.union(
      v.literal("draft"),
      v.literal("scripting"),
      v.literal("storyboarding"),
      v.literal("production"),
      v.literal("completed")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_updated", ["userId", "updatedAt"]),

  // Scripts - the generated screenplay
  scripts: defineTable({
    projectId: v.id("projects"),
    title: v.string(),
    style: v.string(),
    // AI-selected narrator voice for single-voice mode
    narratorVoice: v.optional(v.string()),
    // Characters for multi-character mode (JSON array of Character objects)
    characters: v.optional(v.string()), // JSON string of Character[]
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"]),

  // Scenes - individual scene data
  scenes: defineTable({
    scriptId: v.id("scripts"),
    projectId: v.id("projects"),
    sceneNumber: v.number(),
    timeRange: v.string(),
    visualDescription: v.string(),
    audioDescription: v.string(),
    cameraShot: v.string(),
    voiceoverText: v.string(),
    // For multi-character mode: JSON array of DialogueLine objects
    dialogue: v.optional(v.string()), // JSON string of DialogueLine[]
    createdAt: v.number(),
  })
    .index("by_script", ["scriptId"])
    .index("by_project", ["projectId"])
    .index("by_script_number", ["scriptId", "sceneNumber"]),

  // Storyboards - the generated image grids
  storyboards: defineTable({
    projectId: v.id("projects"),
    gridType: v.union(v.literal("3x3"), v.literal("3x2")),
    imageUrl: v.string(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"]),

  // Frames - sliced individual frames from storyboards
  frames: defineTable({
    projectId: v.id("projects"),
    sceneId: v.id("scenes"),
    frameNumber: v.number(),
    imageUrl: v.string(),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_scene", ["sceneId"]),

  // Generated videos - output from Veo/Seedance
  videos: defineTable({
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
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_scene", ["sceneId"])
    .index("by_status", ["status"]),

  // Audio tracks - voiceover and background music
  audioTracks: defineTable({
    projectId: v.id("projects"),
    type: v.union(v.literal("voiceover"), v.literal("music")),
    audioUrl: v.string(),
    duration: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_type", ["projectId", "type"]),

  // Generation tasks - for async polling of external APIs
  generationTasks: defineTable({
    projectId: v.id("projects"),
    taskType: v.union(
      v.literal("video_seedance"),
      v.literal("video_veo"),
      v.literal("music_suno"),
      v.literal("audio_tts")
    ),
    externalTaskId: v.string(),
    sceneId: v.optional(v.id("scenes")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    resultUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastPolledAt: v.optional(v.number()),
  })
    .index("by_project", ["projectId"])
    .index("by_status", ["status"])
    .index("by_external_task", ["externalTaskId"]),
});
