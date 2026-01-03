/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as audioTracks from "../audioTracks.js";
import type * as frames from "../frames.js";
import type * as http from "../http.js";
import type * as migrations from "../migrations.js";
import type * as projects from "../projects.js";
import type * as scenes from "../scenes.js";
import type * as storyboards from "../storyboards.js";
import type * as tasks from "../tasks.js";
import type * as videos from "../videos.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  audioTracks: typeof audioTracks;
  frames: typeof frames;
  http: typeof http;
  migrations: typeof migrations;
  projects: typeof projects;
  scenes: typeof scenes;
  storyboards: typeof storyboards;
  tasks: typeof tasks;
  videos: typeof videos;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
