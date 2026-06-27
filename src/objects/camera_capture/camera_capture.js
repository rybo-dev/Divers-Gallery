import { Sprite, Assets, Rectangle } from "pixi.js";
import { saveCapture, isFull, MAX_CAPTURES } from "./capture_store.js";

// ─────────────────────────────────────────────────────────────
//  CameraCapture
//
//  Manages a screen-space "viewfinder" sprite that the player
//  can position with the mouse, scale with the scroll wheel,
//  and trigger a cropped screenshot with left-click hold → release.
//
//  Captured images are passed to CaptureStore as Blobs and can
//  be retrieved from any scene via getCaptures().
//
//  Usage:
//      const camera = new CameraCapture(app);
//      await camera.initialize();   // call once after scene loads
//      // ... later, when scene is destroyed:
//      camera.destroy();
// ─────────────────────────────────────────────────────────────
export class CameraCapture {

    // ── Constructor ──────────────────────────────────────────
    constructor(pixiApp) {

        // Store a reference to the PixiJS application so we can
        // access the renderer, stage, and canvas later.
        this.pixiApp = pixiApp;

        // The viewfinder sprite — created in initialize().
        this.sprite = null;

        // The three possible states this class can be in:
        //   "idle"       → sprite hidden, doing nothing
        //   "preparing"  → left mouse is held, sprite visible and following mouse
        //   "capturing"  → mouse was released, waiting one frame before screenshotting
        this.state = "idle";

        // The last recorded mouse position in screen coordinates.
        // Updated every time the mouse moves.
        this.mouseX = 0;
        this.mouseY = 0;

        // The sprite's clamped position saved at the moment the left
        // button is released. We use this (not the live mouse position)
        // for the capture rectangle, because by the time the async
        // capture runs the mouse may have already moved.
        this.captureX = 0;
        this.captureY = 0;

        // Scale limits for the viewfinder sprite.
        this.SCALE_MAX  = 0.7;   // default / maximum size
        this.SCALE_MIN  = 0.3;   // smallest the player can shrink it to
        this.SCALE_STEP = 0.001; // how much each scroll-wheel tick changes the scale

        // Current uniform scale of the sprite (same value applied to x and y).
        this.currentScale = this.SCALE_MAX;

        // ── Bound event handler references ───────────────────
        // Stored as arrow-function properties so we can pass the
        // exact same reference to both addEventListener and
        // removeEventListener. Without this, removeEventListener
        // would fail to locate and remove the listener.
        this.onPointerMove   = (event) => this._handlePointerMove(event);
        this.onPointerDown   = (event) => this._handlePointerDown(event);
        this.onPointerUp     = (event) => this._handlePointerUp(event);
        this.onWheel         = (event) => this._handleWheel(event);
        this.onContextMenu   = (event) => this._handleContextMenu(event);
    }


    // ── initialize ───────────────────────────────────────────
    // Must be called once (and awaited) before the camera is usable.
    // Retrieves the sprite texture and registers all event listeners.
    async initialize() {

        // Retrieve the texture that was already loaded as part of the
        // "sea_scene" bundle. Assets.get() is synchronous and returns
        // the cached texture — no network request happens here.
        const cameraSnapTexture = Assets.get("camera_snap");

        // Build the viewfinder sprite from that texture.
        this.sprite = new Sprite(cameraSnapTexture);

        // Anchor 0.5 means the sprite's origin is its center,
        // so positioning it at (mouseX, mouseY) keeps it perfectly
        // centered on the cursor.
        this.sprite.anchor.set(0.5);

        // Start hidden and at the default (maximum) scale.
        this.sprite.visible = false;
        this.sprite.scale.set(this.currentScale);

        // Add the sprite directly to the top level of the stage so it
        // always renders above every other container (camera, scene, HUD).
        // Adding it last means it draws on top of everything.
        this.pixiApp.stage.addChild(this.sprite);

        // Register all mouse/pointer listeners on the underlying canvas element.
        // We use the native canvas rather than PixiJS's interaction system so
        // the camera works regardless of what is underneath the cursor.
        const canvas = this.pixiApp.canvas;
        canvas.addEventListener("pointermove",  this.onPointerMove);
        canvas.addEventListener("pointerdown",  this.onPointerDown);
        canvas.addEventListener("pointerup",    this.onPointerUp);
        canvas.addEventListener("wheel",        this.onWheel,      { passive: true });
        canvas.addEventListener("contextmenu",  this.onContextMenu);
    }


    // ── _handlePointerMove ───────────────────────────────────
    // Fires continuously as the mouse moves over the canvas.
    _handlePointerMove(event) {

        // Always keep the stored mouse position up to date.
        this.mouseX = event.offsetX;
        this.mouseY = event.offsetY;

        // Only reposition the sprite while we are in the preparing state.
        // In idle state the sprite is invisible so there is nothing to move.
        if (this.state === "preparing") {
            this.sprite.x = this.mouseX;
            this.sprite.y = this.mouseY;

            // After moving, make sure the sprite hasn't drifted outside
            // the canvas edges.
            this._clampToBounds();
        }
    }


    // ── _handlePointerDown ───────────────────────────────────
    // Fires when any mouse button is pressed while over the canvas.
    _handlePointerDown(event) {

        // button === 0  →  left mouse button.
        // Only respond to left clicks while idle, and only if the
        // capture store still has room for more captures.
        if (event.button !== 0 || this.state !== "idle") return;

        // If the player has already hit the 70-capture limit, block
        // the camera from activating and warn them.
        if (isFull()) {
            console.warn(`[CameraCapture] Capture limit of ${MAX_CAPTURES} reached. No more captures allowed.`);

            // TODO: replace this log with a visible in-game UI message
            // so the player knows why the camera isn't responding.
            return;
        }

        this.state = "preparing";

        // Place and reveal the sprite at the current cursor position.
        this.sprite.x       = this.mouseX;
        this.sprite.y       = this.mouseY;
        this.sprite.visible = true;

        // Snap it inside the canvas edges immediately before the player moves.
        this._clampToBounds();
    }


    // ── _handlePointerUp ─────────────────────────────────────
    // Fires when a mouse button is released over the canvas.
    _handlePointerUp(event) {

        // Only act on a left-button release while we are preparing.
        if (event.button !== 0 || this.state !== "preparing") return;

        this.state = "capturing";

        // Save the capture center NOW — we use the sprite's already-clamped
        // position rather than raw mouseX/Y so the rectangle matches exactly
        // what was visible in the viewfinder.
        this.captureX = this.sprite.x;
        this.captureY = this.sprite.y;

        // Also save the scale, because by the time _capture() runs the
        // sprite will have been reset, so we can't read it from the sprite.
        this.captureScale = this.currentScale;

        // Hide the sprite BEFORE the screenshot so it does not appear
        // in the captured image.
        this.sprite.visible = false;

        // Defer the capture by one animation frame to give PixiJS time
        // to re-render the scene without the sprite visible.
        requestAnimationFrame(() => {
            this._capture();
        });
    }


    // ── _handleWheel ─────────────────────────────────────────
    // Fires when the user scrolls the mouse wheel over the canvas.
    _handleWheel(event) {

        // Ignore scroll events when the camera is not active.
        if (this.state !== "preparing") return;

        // deltaY is positive when scrolling down (zoom out) and
        // negative when scrolling up (zoom in).
        // Multiplying by SCALE_STEP converts the large pixel delta
        // into a small, controlled scale nudge.
        this.currentScale -= event.deltaY * this.SCALE_STEP;

        // Clamp scale so it never leaves the [SCALE_MIN, SCALE_MAX] range.
        this.currentScale = Math.min(this.SCALE_MAX, Math.max(this.SCALE_MIN, this.currentScale));

        // Apply the new scale to the sprite.
        this.sprite.scale.set(this.currentScale);

        // Scaling up might push the sprite past a canvas edge, so re-clamp.
        this._clampToBounds();
    }


    // ── _handleContextMenu ───────────────────────────────────
    // Fires when the user right-clicks on the canvas.
    _handleContextMenu(event) {

        // Prevent the browser's native right-click context menu from appearing.
        event.preventDefault();

        // Right-click cancels the current capture preparation.
        if (this.state === "preparing") {
            this._resetToIdle();
        }
    }


    // ── _clampToBounds ───────────────────────────────────────
    // Ensures the viewfinder sprite never extends past any canvas edge.
    // Called after every move and every scale change — this is the
    // "kick" that snaps the sprite back in if it went out of bounds.
    _clampToBounds() {

        const canvasWidth  = this.pixiApp.screen.width;
        const canvasHeight = this.pixiApp.screen.height;

        // sprite.width / sprite.height already account for the current scale,
        // so no manual multiplication is needed.
        // Dividing by 2 gives the distance from center to each edge,
        // which is correct because the anchor is at 0.5.
        const halfWidth  = this.sprite.width  / 2;
        const halfHeight = this.sprite.height / 2;

        // Clamp X: leftmost center position is halfWidth (left edge flush),
        // rightmost is canvasWidth - halfWidth (right edge flush).
        this.sprite.x = Math.min(canvasWidth  - halfWidth,  Math.max(halfWidth,  this.sprite.x));

        // Clamp Y: same logic for the vertical axis.
        this.sprite.y = Math.min(canvasHeight - halfHeight, Math.max(halfHeight, this.sprite.y));
    }


    // ── _capture ─────────────────────────────────────────────
    // Called one animation frame after mouse release, once the sprite
    // is guaranteed to be hidden from the rendered output.
    async _capture() {

        // ── BUILD THE CAPTURE RECTANGLE ───────────────────────
        // Reconstruct the pixel dimensions of the viewfinder area using
        // the saved scale (not currentScale — that gets reset in _resetToIdle).
        const texture     = Assets.get("camera_snap");
        const pixelWidth  = texture.width  * this.captureScale;
        const pixelHeight = texture.height * this.captureScale;

        // Rectangle(x, y, width, height) expects the TOP-LEFT corner,
        // so we offset from the saved center position by half the size.
        const captureRectangle = new Rectangle(
            this.captureX - pixelWidth  / 2,
            this.captureY - pixelHeight / 2,
            pixelWidth,
            pixelHeight,
        );

        // ── EXTRACT THE PIXELS ────────────────────────────────
        // app.renderer.extract.image() renders the full stage but crops
        // the output to captureRectangle, returning an HTMLImageElement.
        //
        // We then convert that image to a Blob (raw binary PNG data)
        // so we can store it efficiently without base64 bloat.
        try {

            // Extract the cropped region as an HTMLImageElement.
            // The sprite is already hidden, so it will not appear in the output.
            const extractedImage = await this.pixiApp.renderer.extract.image({
                target: this.pixiApp.stage,  // render from the root of the scene
                frame:  captureRectangle,    // crop to the viewfinder area
                format: "png",
            });

            // Convert the HTMLImageElement → Canvas → Blob so we can store
            // raw binary data instead of a large base64 string.
            //
            // Step 1: draw the image onto a temporary off-screen canvas.
            const offscreenCanvas        = document.createElement("canvas");
            offscreenCanvas.width        = pixelWidth;
            offscreenCanvas.height       = pixelHeight;
            const context2d              = offscreenCanvas.getContext("2d");
            context2d.drawImage(extractedImage, 0, 0);

            // Step 2: export the canvas pixels as a PNG Blob.
            // toBlob() is asynchronous, so we wrap it in a Promise.
            const imageBlob = await new Promise((resolve) => {
                offscreenCanvas.toBlob((blob) => resolve(blob), "image/png");
            });

            // Step 3: hand the Blob to CaptureStore, which converts it to
            // a blob URL and pushes it into the shared captures array.
            const wasSaved = saveCapture(imageBlob);

            if (wasSaved) {
                console.log("[CameraCapture] Capture complete.", captureRectangle);
            }

        } catch (error) {
            console.error("[CameraCapture] Screenshot failed:", error);
        }

        // Return to idle whether the capture succeeded or failed.
        this._resetToIdle();
    }


    // ── _resetToIdle ─────────────────────────────────────────
    // Shared cleanup used by both cancel (right-click) and post-capture.
    _resetToIdle() {

        this.state          = "idle";
        this.sprite.visible = false;

        // Reset scale back to the default maximum for the next use.
        this.currentScale = this.SCALE_MAX;
        this.sprite.scale.set(this.currentScale);
    }


    // ── destroy ──────────────────────────────────────────────
    // Call this when the scene unloads to prevent memory leaks and
    // ghost event listeners persisting after the scene is gone.
    destroy() {

        const canvas = this.pixiApp.canvas;
        canvas.removeEventListener("pointermove",  this.onPointerMove);
        canvas.removeEventListener("pointerdown",  this.onPointerDown);
        canvas.removeEventListener("pointerup",    this.onPointerUp);
        canvas.removeEventListener("wheel",        this.onWheel);
        canvas.removeEventListener("contextmenu",  this.onContextMenu);

        // Remove the sprite from the stage and free its GPU texture memory.
        if (this.sprite) {
            this.pixiApp.stage.removeChild(this.sprite);
            this.sprite.destroy();
            this.sprite = null;
        }
    }
}