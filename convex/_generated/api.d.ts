/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as benchmark from "../benchmark.js";
import type * as checkIns from "../checkIns.js";
import type * as checklist from "../checklist.js";
import type * as lib from "../lib.js";
import type * as marathonStatus from "../marathonStatus.js";
import type * as runLog from "../runLog.js";
import type * as strengthLog from "../strengthLog.js";
import type * as syncState from "../syncState.js";
import type * as validators from "../validators.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  benchmark: typeof benchmark;
  checkIns: typeof checkIns;
  checklist: typeof checklist;
  lib: typeof lib;
  marathonStatus: typeof marathonStatus;
  runLog: typeof runLog;
  strengthLog: typeof strengthLog;
  syncState: typeof syncState;
  validators: typeof validators;
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
