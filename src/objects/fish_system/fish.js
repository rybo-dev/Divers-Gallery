// Fish.js
// ---------------------------------------------------------------------------
// The base class that every fish species inherits from.
// This class handles all the things every fish has in common:
//   - A PixiJS Container (holds the sprite + text label)
//   - A TextSlot (the text buffer this fish can display)
//   - Velocity (how fast and in what direction the fish is moving)
//   - Boundary awareness (knows when it's offscreen or near the sea floor)
//   - A reference to its species config (from fishConfig.js)
//
// What this class does NOT do:
//   - Decide how to move (that's the StateMachine in SolitaryFish / SchoolFish)
//   - Know about schools (that's SchoolFish)
//   - Render itself (PixiJS handles that — we just update positions)
//
// INHERITANCE CHAIN:
//   Fish
//    ├── SolitaryFish  → Clownfish, Pufferfish, Jellyfish, ...
//    └── SchoolFish    → Sardine, Tuna, ...
// ---------------------------------------------------------------------------

import { Container, Text } from "pixi.js";
import { TextSlot } from "./textslot.js";

export class Fish {
  /**
   * @param {Object} speciesConfig - The species entry from fishConfig.js
   *                                 (e.g. the sardine object with spawnWeight, speeds, etc.)
   * @param {Bounds} sceneBounds   - The Bounds object describing the playable area.
   */
  constructor(speciesConfig, sceneBounds) {
    this.speciesConfig = speciesConfig;
    this.sceneBounds = sceneBounds;

    // A unique ID for this fish instance — useful for debugging and for the
    // TextDistributor to track which fish it has already assigned text to.
    this.instanceId = Fish.nextInstanceId++;

    // -------------------------------------------------------------------------
    // PIXI CONTAINER
    // The container holds the sprite and the text label as children.
    // Moving the container moves both at once.
    // -------------------------------------------------------------------------
    this.container = new Container();

    // The sprite is added by the subclass (species class) once it knows
    // which texture to use. We declare it here so the base class can
    // reference it safely.
    this.sprite = null;

    // The PixiJS Text object that displays this fish's TextSlot content.
    // Created here with default style — species classes can override the style.
    this.textLabel = new Text({
        text: "",
        style: {
            fontFamily: "Arial",
            fontSize: 14,
            fill: 0x000000,
            align: "center",
            dropShadow: true,
            dropShadowDistance: 1,
        }
    });
    // Center the text label above the fish.
    this.textLabel.anchor.set(0.5, 1); // anchor at bottom-center
    this.textLabel.y = -10;            // sit 10px above the container origin
    this.container.addChild(this.textLabel);

    // -------------------------------------------------------------------------
    // TEXT SLOT
    // This is the text buffer. The TextDistributor fills it via receive().
    // -------------------------------------------------------------------------
    this.textSlot = new TextSlot(
      speciesConfig.textSlotCapacity,
      speciesConfig.textDisplayDuration,
      speciesConfig.textFadeDuration
    );

    // -------------------------------------------------------------------------
    // MOVEMENT
    // Velocity is stored as separate x and y components (pixels per second).
    // The StateMachine (in subclasses) writes to these.
    // The update() method here reads them and moves the container.
    // -------------------------------------------------------------------------
    this.velocityX = 0;
    this.velocityY = 0;

    // Whether this fish is currently active and should be updated.
    // The pool sets this to false when a fish is returned to the pool.
    this.isActive = false;

    // Whether this fish is currently visible on screen.
    // Updated each frame by checkIfOnScreen().
    this.isOnScreen = false;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API — called by FishSpawner and TextDistributor
  // ---------------------------------------------------------------------------

  /**
   * Convenience getter — wraps TextSlot.isEmpty so callers don't need to know
   * about the TextSlot internals.
   */
  get hasEmptyTextSlot() {
    return this.textSlot.isEmpty || 
           this.textSlot.currentText.length < this.textSlot.characterCapacity;
  }

  /**
   * The x position of this fish in the scene (center of its container).
   */
  get x() { return this.container.x; }
  set x(value) { this.container.x = value; }

  /**
   * The y position of this fish in the scene (center of its container).
   */
  get y() { return this.container.y; }
  set y(value) { this.container.y = value; }

  /**
   * Returns true once the fish has moved COMPLETELY past the left or right
   * scene boundary. "Completely" means the entire sprite width is off-screen.
   *
   * The FishSpawner polls this every frame to decide when to despawn.
   *
   * @returns {boolean}
   */
  isFullyOffscreen() {
    const spriteHalfWidth = this.sprite ? this.sprite.width / 2 : 20;

    // Only check the edge the fish is heading toward.
    // A fish moving right can only exit via the right edge, and vice versa.
    if (this.velocityX >= 0) {
        return (this.container.x - spriteHalfWidth) > this.sceneBounds.rightEdgeX;
    } else {
        return (this.container.x + spriteHalfWidth) < this.sceneBounds.leftEdgeX;
    }
  }

  /**
   * Updates isOnScreen based on whether the fish's x position is within
   * the scene boundaries. Used by TextDistributor to find valid targets.
   */
  checkIfOnScreen() {
    const spriteHalfWidth = this.sprite ? this.sprite.width / 2 : 20;

    this.isOnScreen = (
      (this.container.x + spriteHalfWidth) >= this.sceneBounds.leftEdgeX &&
      (this.container.x - spriteHalfWidth) <= this.sceneBounds.rightEdgeX
    );
  }

  /**
   * Calculates the distance from this fish to another fish.
   * Used by TextDistributor to find the nearest empty fish to pass text to.
   *
   * @param {Fish} otherFish
   * @returns {number} Distance in pixels.
   */
  distanceTo(otherFish) {
    const dx = this.container.x - otherFish.container.x;
    const dy = this.container.y - otherFish.container.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // ---------------------------------------------------------------------------
  // BOUNDARY STEERING HELPERS
  // These are used by the StateMachine states in SolitaryFish and SchoolGroup.
  // They return a nudge value (positive or negative) that gets added to velocity
  // to push the fish away from the surface and sea floor.
  // ---------------------------------------------------------------------------

  /**
   * Returns a Y velocity nudge to steer the fish away from the surface and floor.
   * The closer the fish is to the boundary, the stronger the nudge.
   *
   * @param {number} repulsionDistance - How many pixels from the boundary the
   *                                     nudge starts. From SPAWNER_SETTINGS.
   * @param {number} repulsionStrength - Max pixels-per-second added by the nudge.
   * @returns {number} A velocity delta to add to velocityY this frame.
   */
  calculateYBoundaryNudge(repulsionDistance, repulsionStrength = 60) {
    let nudge = 0;

    const distanceFromSurface = this.container.y - this.sceneBounds.surfaceY;
    const distanceFromFloor   = this.sceneBounds.seaFloorY - this.container.y;

    // Too close to the surface — nudge downward (positive Y).
    if (distanceFromSurface < repulsionDistance) {
      const howCloseAsFraction = 1 - (distanceFromSurface / repulsionDistance);
      nudge += howCloseAsFraction * repulsionStrength;
    }

    // Too close to the floor — nudge upward (negative Y).
    if (distanceFromFloor < repulsionDistance) {
      const howCloseAsFraction = 1 - (distanceFromFloor / repulsionDistance);
      nudge -= howCloseAsFraction * repulsionStrength;
    }

    return nudge;
  }

  // ---------------------------------------------------------------------------
  // UPDATE — called every frame by the scene
  // ---------------------------------------------------------------------------

  /**
   * Base update. Moves the fish according to its velocity, updates the text slot,
   * and syncs the text label display.
   *
   * Subclasses call super.update(deltaTime) and then run their own AI logic.
   *
   * @param {number} deltaTime - Seconds since the last frame.
   */
  update(deltaTime) {
    if (!this.isActive) return;

    // --- Move the fish ---
    this.container.x += this.velocityX * deltaTime;
    this.container.y += this.velocityY * deltaTime;

    // --- Flip the sprite to face the direction of travel ---
    if (this.sprite) {
      // scaleX of -1 mirrors the sprite horizontally.
        const flipDirection = this.velocityX >= 0 ? 1 : -1;
        const scale = this.speciesConfig.spriteScale ?? 1;
        this.sprite.scale.set(scale * flipDirection, scale);
    }

    // --- Update the text slot timer ---
    this.textSlot.update(deltaTime);

    // --- Sync the text label to the slot ---
    this.textLabel.text    = this.textSlot.currentText;
    this.textLabel.alpha   = this.textSlot.currentOpacity;

    // --- Check if still on screen ---
    this.checkIfOnScreen();
  }

  // ---------------------------------------------------------------------------
  // POOL RESET — called by FishSpawner when returning a fish to the pool
  // ---------------------------------------------------------------------------

  /**
   * Resets the fish to a clean state so it can be reused from the pool.
   * The subclass should also reset its StateMachine when this is called.
   */
  resetForPool() {
    this.isActive = false;
    this.isOnScreen = false;
    this.velocityX = 0;
    this.velocityY = 0;
    this.textSlot.clear();
    this.textLabel.text = "";
    this.textLabel.alpha = 0;
    this.container.visible = false;
  }

  /**
   * Activates this fish after being taken from the pool (or newly created).
   * Sets position, makes it visible, and marks it active.
   *
   * @param {number} startX - Starting x position.
   * @param {number} startY - Starting y position.
   */
  activateAt(startX, startY) {
    this.container.x = startX;
    this.container.y = startY;
    this.container.visible = true;
    this.isActive = true;
  }
}

// Static counter — gives each fish a unique ID number for debugging.
Fish.nextInstanceId = 1;