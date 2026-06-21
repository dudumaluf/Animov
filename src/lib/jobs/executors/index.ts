"use client";

/**
 * Side-effect registry barrel.
 * Importing this file triggers `registerExecutor(...)` in each executor
 * module, wiring the batch store's dispatcher to concrete backends. Import
 * once at editor bootstrap so the registry is populated before any UI
 * attempts to dispatch a batch.
 */

import "./video-scene";
import "./video-transition";
import "./video-reference";
import "./music";
import "./image-edit";

export {};
