// ─────────────────────────────────────────────────────────────
//  CaptureStore.js
//
//  A shared in-memory store for camera captures.
//  Any scene can import this module and access the same array,
//  because ES modules are singletons — every import points to
//  the exact same instance for the lifetime of the session.
//
//  Usage (in any scene or class):
//      import { saveCapture, getCaptures, getCaptureCount, MAX_CAPTURES } from "./CaptureStore.js";
// ─────────────────────────────────────────────────────────────

// The maximum number of captures the player is allowed to take.
// Exported so other files (UI, CameraCapture, menu) can read
// this value without hardcoding it in multiple places.
export const MAX_CAPTURES = 70;

// The internal array holding all captures taken this session.
// Each entry is an object: { blobUrl: string, timestamp: number }
//
//   blobUrl   → a temporary URL created from a Blob, usable directly
//               as the src of an <img> or a PixiJS Texture.from().
//               Valid for the lifetime of the tab — gone on refresh.
//
//   timestamp → Date.now() at the moment of capture, useful if you
//               want to sort or label captures in the menu.
const captures = [];


// ── saveCapture ──────────────────────────────────────────────
// Adds a new capture to the store.
// Returns true if the capture was saved, or false if the cap
// of MAX_CAPTURES has already been reached.
//
// @param {Blob} imageBlob  - the raw PNG blob from the renderer
export function saveCapture(imageBlob) {

    // Refuse to save if we've already hit the limit.
    if (captures.length >= MAX_CAPTURES) {
        console.warn(`[CaptureStore] Capture limit of ${MAX_CAPTURES} reached. This capture was not saved.`);
        return false;
    }

    // URL.createObjectURL() turns the raw Blob into a temporary
    // URL like "blob:http://localhost:5173/abc123..." that the
    // browser can use as an image source directly.
    const blobUrl = URL.createObjectURL(imageBlob);

    captures.push({
        blobUrl:   blobUrl,
        timestamp: Date.now(),
    });

    console.log(`[CaptureStore] Capture saved. Total: ${captures.length} / ${MAX_CAPTURES}`);
    return true;
}


// ── getCaptures ──────────────────────────────────────────────
// Returns the full array of capture objects.
// The menu scene calls this to build its gallery display.
//
// @returns {{ blobUrl: string, timestamp: number }[]}
export function getCaptures() {
    return captures;
}


// ── getCaptureCount ──────────────────────────────────────────
// Returns how many captures have been taken so far.
// Useful for showing the player "12 / 70" in a HUD counter.
//
// @returns {number}
export function getCaptureCount() {
    return captures.length;
}


// ── isFull ───────────────────────────────────────────────────
// Returns true if the player has used all available capture slots.
// CameraCapture uses this to disable the camera when the limit is hit.
//
// @returns {boolean}
export function isFull() {
    return captures.length >= MAX_CAPTURES;
}


// ── clearCaptures ────────────────────────────────────────────
// Revokes all blob URLs and empties the store.
// Call this if you ever add a "reset" feature — not needed for
// a one-time-play game but included for completeness.
export function clearCaptures() {

    // URL.createObjectURL() allocates memory in the browser.
    // Revoking each URL frees that memory — skipping this would
    // be a memory leak if the player somehow took many captures.
    for (const capture of captures) {
        URL.revokeObjectURL(capture.blobUrl);
    }

    captures.length = 0; // empties the array in place without reassigning it
    console.log("[CaptureStore] All captures cleared.");
}