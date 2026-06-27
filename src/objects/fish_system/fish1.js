// Fish1.js
// ---------------------------------------------------------------------------
// A minimal solitary fish species used as a placeholder to verify the system
// is working before adding real artwork and unique behavior.
//
// This is the thinnest possible species class — it only loads its sprite.
// All movement behavior comes from SolitaryFish (SWIM, IDLE, TURN states).
// ---------------------------------------------------------------------------

// The only things we need from PixiJS for a basic species class:
//   Sprite   — to display the fish image
//   Texture  — only needed if you construct a texture manually (not needed here
//              since we receive pre-loaded textures from loadedTextures)
import { Sprite } from "pixi.js";

import { SolitaryFish } from "./solitary_fish.js";

export class Fish1 extends SolitaryFish {
    /**
     * @param {Object} speciesConfig  - The fish1 entry from fishConfig.js.
     * @param {Bounds} sceneBounds    - The scene's playable area.
     * @param {Object} loadedTextures - The texture map passed down from loadLevel.
     *                                  We grab our texture from here using our spriteKey.
     */
    constructor(speciesConfig, sceneBounds, loadedTextures) {
        super(speciesConfig, sceneBounds);

        // Grab the pre-loaded texture using the spriteKey defined in fishConfig.js.
        // Because loadLevel already awaited the bundle, this is guaranteed to exist.
        const fish1Texture = loadedTextures[speciesConfig.spriteKey];

        // Create the sprite from that texture and center its anchor point.
        this.sprite = new Sprite(fish1Texture);
        this.sprite.anchor.set(0.5);
        this.sprite.scale.set(speciesConfig.spriteScale);

        // Add the sprite and text label to the container. The container's position is
        // controlled by the base Fish class, and the text label is positioned above
        // the sprite, so we don't need to set their positions here.
        this.container.addChild(this.sprite);
        this.container.addChild(this.textLabel);
    }

    // No update() override needed — SolitaryFish handles all movement.
    // No buildStateMap() override needed — Fish1 uses the default SWIM/IDLE/TURN states.
    // Add those overrides later when Fish1 needs unique behavior.
}