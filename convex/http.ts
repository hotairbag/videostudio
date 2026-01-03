import { httpRouter } from "convex/server";

const http = httpRouter();

// Clerk handles auth via JWT validation configured in auth.config.ts
// No HTTP routes needed for Clerk integration

export default http;
