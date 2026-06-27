import { Sprite, Texture, Container } from "pixi.js";
import { getCaptures } from "./capture_store.js";

// ─────────────────────────────────────────────────────────────
//  CaptureGallery
//
//  Displays up to 4 captures at a time from CaptureStore,
//  arranged at positions you define in the menu scene.
//  Previous / next buttons page through captures in groups of 4.
//  Empty slots are shown as blank (transparent) sprites.
//
//  Usage (in your menu scene):
//
//      const gallery = new CaptureGallery({
//          app: app,
//          parent: someContainer,       // the container to add slots + buttons to
//          slotPositions: [             // 4 {x, y} points in the parent's local space
//              { x: 100, y: 200 },
//              { x: 300, y: 200 },
//              { x: 100, y: 400 },
//              { x: 300, y: 400 },
//          ],
//          prevButton: myPrevSprite,    // any PixiJS DisplayObject with eventMode
//          nextButton: myNextSprite,    // same
//          slotWidth:  200,             // how wide each capture slot should be (px)
//          slotHeight: 150,             // how tall each capture slot should be (px)
//      });
//
//      await gallery.initialize();
//
//      // when the menu scene is destroyed:
//      gallery.destroy();
// ─────────────────────────────────────────────────────────────
export class CaptureGallery {

    // ── Constructor ──────────────────────────────────────────
    // @param {object} config - all setup options (see usage above)
    constructor(config) {

        // The PixiJS app — needed to release textures on destroy.
        this.app = config.app;

        // The PixiJS container this gallery lives inside (your menu panel).
        // Slot sprites and button listeners are attached relative to this.
        this.parent = config.parent;

        // Array of 4 {x, y} objects defining where each slot sits
        // in the parent container's local coordinate space.
        // You set these in the menu scene to match your background sprite layout.
        this.slotPositions = config.slotPositions;

        // The DisplayObjects (sprites, etc.) the player clicks to page.
        // These must already exist — CaptureGallery just attaches listeners to them.
        this.prevButton = config.prevButton;
        this.nextButton = config.nextButton;

        // The pixel dimensions each capture image is scaled to fit inside its slot.
        // Captures are scaled uniformly (preserving aspect ratio) to fit within
        // these bounds without overflowing.
        this.slotWidth  = config.slotWidth;
        this.slotHeight = config.slotHeight;

        // Which page we are currently on. Each page shows 4 captures.
        // Page 0 → captures 0-3, page 1 → captures 4-7, etc.
        this.currentPage = 0;

        // The 4 PixiJS Sprites that act as the visible slots.
        // These are reused across pages — we just swap their textures.
        this.slotSprites = [];

        // We hold references to the Textures we create from blob URLs so
        // we can destroy them properly when the gallery is destroyed,
        // freeing GPU memory.
        this.activeTextures = [];

        // ── Bound button handler references ──────────────────
        // Stored as properties so we can cleanly remove them in destroy().
        this.onPrevClick = () => this._goToPrevPage();
        this.onNextClick = () => this._goToNextPage();
    }


    // ── initialize ───────────────────────────────────────────
    // Creates the 4 slot sprites, attaches button listeners,
    // and renders the first page.
    // Must be called (and awaited) before the gallery is visible.
    async initialize() {

        // ── Create the 4 slot sprites ─────────────────────────
        // Each slot starts as an empty transparent sprite.
        // We create them once here and reuse them when paging.
        for (let slotIndex = 0; slotIndex < 4; slotIndex++) {

            const slotSprite = new Sprite(Texture.EMPTY);

            // Position the slot at the coordinate defined by the menu scene.
            slotSprite.x = this.slotPositions[slotIndex].x;
            slotSprite.y = this.slotPositions[slotIndex].y;

            // Anchor at center so the capture image sits centered
            // on the defined position point.
            slotSprite.anchor.set(0.5);

            this.parent.addChild(slotSprite);
            this.slotSprites.push(slotSprite);
        }

        // ── Wire up the previous / next buttons ───────────────
        // Enable pointer interaction on both buttons so they respond to clicks.
        this.prevButton.eventMode = "static";
        this.nextButton.eventMode = "static";
        this.prevButton.cursor    = "pointer";
        this.nextButton.cursor    = "pointer";

        this.prevButton.on("pointerup", this.onPrevClick);
        this.nextButton.on("pointerup", this.onNextClick);

        // ── Render the first page ─────────────────────────────
        await this._renderPage(this.currentPage);
    }

    // ── setVisible ───────────────────────────────────────────────
    // Shows or hides all 4 slot sprites.
    // Call this whenever isAlbumVisible is toggled in the menu scene.
    //
    // @param {boolean} visible
    setVisible(visible) {
        for (const slotSprite of this.slotSprites) {
            slotSprite.visible = visible;
        }
    }

    // ── _renderPage ──────────────────────────────────────────
    // Updates all 4 slot sprites to show the captures for the given page.
    // Releases any textures from the previous page to free GPU memory.
    //
    // @param {number} pageIndex - the page to display (0-based)
    async _renderPage(pageIndex) {

        const captures = getCaptures();

        // ── Release previous page textures ────────────────────
        // Before we reassign slot textures, destroy the ones we made last time.
        // Without this, every page turn would leak GPU texture memory.
        for (let i = 0; i < this.slotSprites.length; i++) {
            this.slotSprites[i].texture = Texture.EMPTY;
        }

        for (const oldTexture of this.activeTextures) {
            oldTexture.destroy(false); // destroys the Texture wrapper only, leaves GPU source intact
        }
        this.activeTextures = [];

        // ── Assign textures to each slot ──────────────────────
        // The first capture index on this page is pageIndex * 4.
        // e.g. page 0 → index 0, page 1 → index 4, page 2 → index 8 ...
        const firstCaptureIndex = pageIndex * 4;

        for (let slotIndex = 0; slotIndex < 4; slotIndex++) {
            
            const captureIndex = firstCaptureIndex + slotIndex;
            const slotSprite   = this.slotSprites[slotIndex];

            if (captureIndex < captures.length) {

                // ── Slot has a capture ────────────────────────
                // Load the blob URL as a PixiJS Texture, then assign it.
                const blobUrl = captures[captureIndex].blobUrl;
                const texture = await new Promise((resolve, reject) => {
                const image  = new Image();
                    image.onload = () => resolve(Texture.from(image));
                    image.onerror = reject;
                    image.src    = blobUrl;
                });

                slotSprite.texture = texture;

                // Scale the capture to fit within the slot dimensions
                // while preserving its original aspect ratio.
                this._fitToSlot(slotSprite, texture);

                // Track this texture so we can destroy it on the next page turn.
                this.activeTextures.push(texture);

            } else {

                // ── Slot is empty ─────────────────────────────
                // Assign an empty transparent texture and reset the scale
                // so the slot takes up no visible space.
                slotSprite.texture  = Texture.EMPTY;
                slotSprite.scale.set(1);
            }
        }

        // ── Update button visibility ───────────────────────────
        // Hide the previous button on the first page (nothing to go back to).
        // Hide the next button on the last page (nothing to go forward to).
        this.prevButton.visible = pageIndex > 0;
        this.nextButton.visible = firstCaptureIndex + 4 < captures.length;
    }


    // ── _fitToSlot ───────────────────────────────────────────
    // Scales a sprite so its texture fits within (slotWidth x slotHeight)
    // without stretching or overflowing, preserving the original aspect ratio.
    //
    // @param {Sprite}  sprite  - the slot sprite to scale
    // @param {Texture} texture - the texture now assigned to that sprite
    _fitToSlot(sprite, texture) {

        // How much would we need to scale the image to fill the slot width?
        const scaleByWidth  = this.slotWidth  / texture.width;

        // How much would we need to scale the image to fill the slot height?
        const scaleByHeight = this.slotHeight / texture.height;

        // Use whichever scale is smaller — this ensures neither dimension
        // overflows its boundary (letterboxing / pillarboxing behaviour).
        const uniformScale = Math.min(scaleByWidth, scaleByHeight);

        sprite.scale.set(uniformScale);
    }


    // ── _goToPrevPage ────────────────────────────────────────
    // Moves back one page and re-renders. Ignores the press on page 0.
    async _goToPrevPage() {

        if (this.currentPage <= 0) return;

        this.currentPage -= 1;
        await this._renderPage(this.currentPage);
    }


    // ── _goToNextPage ────────────────────────────────────────
    // Moves forward one page and re-renders.
    // Ignores the press if we are already on the last page.
    async _goToNextPage() {

        const captures       = getCaptures();
        const totalPages     = Math.ceil(captures.length / 4);
        const lastPageIndex  = totalPages - 1;

        if (this.currentPage >= lastPageIndex) return;

        this.currentPage += 1;
        await this._renderPage(this.currentPage);
    }


    // ── destroy ──────────────────────────────────────────────
    // Cleans up sprites, textures, and event listeners.
    // Call this when the menu scene is unloaded.
    destroy() {

        // Remove button listeners.
        this.prevButton.off("pointerup", this.onPrevClick);
        this.nextButton.off("pointerup", this.onNextClick);

        // Destroy all active page textures to free GPU memory.
        for (const texture of this.activeTextures) {
            texture.destroy(true);
        }
        this.activeTextures = [];

        // Remove and destroy each slot sprite.
        for (const slotSprite of this.slotSprites) {
            this.parent.removeChild(slotSprite);
            slotSprite.destroy();
        }
        this.slotSprites = [];
    }
}