// Character.js
import { Sprite, Texture } from 'pixi.js';

export class Character {

    // speed:   how many pixels the character moves per frame
    // scale:   how large the sprite appears (1 = original size, 0.5 = half size)
    // texture: a Texture object loaded from Assets.get() in your scene
    constructor({ speed, scale, texture }) {

        this.speed = speed;

        // Create the sprite from the texture passed in from the scene
        this.sprite = new Sprite(texture);

        // Anchor at center so the sprite's x/y refers to its middle point
        this.sprite.anchor.set(0.5);
        this.sprite.scale.set(scale);

        // Current movement per frame on each axis, calculated from key input
        this.horizontalVelocity = 0;
        this.verticalVelocity = 0;

        // Tracks which movement keys are currently being held down
        this.keysHeld = {
            up:    false,   // W
            down:  false,   // S
            left:  false,   // A
            right: false,   // D
        };

        // Store the handler references so we can remove them on destroy
        this.handleKeyDown = (event) => this.onKeyDown(event.key);
        this.handleKeyUp   = (event) => this.onKeyUp(event.key);

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup',   this.handleKeyUp);
    }

    // ── Input ─────────────────────────────────────────────────────────────────

    onKeyDown(key) {
        if (key === 'w' || key === 'W') this.keysHeld.up    = true;
        if (key === 'a' || key === 'A') this.keysHeld.left  = true;
        if (key === 's' || key === 'S') this.keysHeld.down  = true;
        if (key === 'd' || key === 'D') this.keysHeld.right = true;
    }

    onKeyUp(key) {
        if (key === 'w' || key === 'W') this.keysHeld.up    = false;
        if (key === 'a' || key === 'A') this.keysHeld.left  = false;
        if (key === 's' || key === 'S') this.keysHeld.down  = false;
        if (key === 'd' || key === 'D') this.keysHeld.right = false;
    }

    // ── Update (call this every ticker tick) ──────────────────────────────────

    update(sceneContainer) {
        this.calculateVelocity();
        this.moveSprite();
        this.clampInsideBounds(sceneContainer);
        this.updateSpriteDirection();
    }

    // Converts held keys into a movement direction, then scales it to the character's speed.
    // Diagonal movement is normalized so it isn't faster than straight movement.
    calculateVelocity() {
        let moveX = 0;
        let moveY = 0;

        if (this.keysHeld.left)  moveX -= 1;
        if (this.keysHeld.right) moveX += 1;
        if (this.keysHeld.up)    moveY -= 1;
        if (this.keysHeld.down)  moveY += 1;

        // Get the length of the movement vector
        const vectorLength = Math.sqrt(moveX * moveX + moveY * moveY);

        if (vectorLength > 0) {
            // Divide by length to normalize (makes the vector length = 1),
            // then multiply by speed to scale it to the right distance per frame
            this.horizontalVelocity = (moveX / vectorLength) * this.speed;
            this.verticalVelocity   = (moveY / vectorLength) * this.speed;
        } else {
            this.horizontalVelocity = 0;
            this.verticalVelocity   = 0;
        }
    }

    // Applies the calculated velocity to the sprite's position
    moveSprite() {
        this.sprite.x += this.horizontalVelocity;
        this.sprite.y += this.verticalVelocity;
    }

    // Prevents the character from walking outside the background area.
    // Assumes the background is the first child (index 0) of the scene container.
    clampInsideBounds(sceneContainer) {
        const background = sceneContainer.children[0];

        // Half the sprite's size is used as a margin so the edges don't cross the boundary
        const halfSpriteWidth  = this.sprite.width  / 2;
        const halfSpriteHeight = this.sprite.height / 2;

        const leftEdge   = halfSpriteWidth;
        const rightEdge  = background.width  - halfSpriteWidth;
        const topEdge    = halfSpriteHeight;
        const bottomEdge = background.height - halfSpriteHeight;

        // Math.max and Math.min together act as a clamp — keeping the value between two limits
        this.sprite.x = Math.max(leftEdge,  Math.min(rightEdge,  this.sprite.x));
        this.sprite.y = Math.max(topEdge,   Math.min(bottomEdge, this.sprite.y));
    }

    // Flips the sprite horizontally to face the direction the character is moving
    updateSpriteDirection() {
        if (this.horizontalVelocity < 0) {
            // Moving left: flip the sprite by making scale negative on the X axis
            this.sprite.scale.x = -Math.abs(this.sprite.scale.x);
        }
        if (this.horizontalVelocity > 0) {
            // Moving right: restore positive scale
            this.sprite.scale.x = Math.abs(this.sprite.scale.x);
        }
        // No horizontal movement: keep whichever direction the sprite was last facing
    }

    // ── Cleanup ───────────────────────────────────────────────────────────────

    // Call this when the scene is destroyed to avoid input leaking into other scenes
    destroy() {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup',   this.handleKeyUp);
        this.sprite.destroy();
    }
}