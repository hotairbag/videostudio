import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Admin query to see all projects (for migration)
export const listAllProjects = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("projects").collect();
  },
});

// Migrate old projects to new userId
export const migrateProjectsToClerkUser = mutation({
  args: {
    newUserId: v.string(),
  },
  handler: async (ctx, { newUserId }) => {
    const projects = await ctx.db.query("projects").collect();

    let migrated = 0;
    for (const project of projects) {
      // Only migrate if userId doesn't already look like a Clerk ID
      if (!project.userId.startsWith("user_")) {
        await ctx.db.patch(project._id, { userId: newUserId });
        migrated++;
      }
    }

    return { migrated, total: projects.length };
  },
});
