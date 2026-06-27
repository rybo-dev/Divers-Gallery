export class Camera {
  constructor(stage, options = {}) {
    this.stage = stage;

    // How quickly the camera catches up to the target (0 = never moves, 1 = instant snap)
    this.lerpFactor = options.lerpFactor ?? 0.08;

    // Optional: clamp the camera so it doesn't go beyond world bounds
    // e.g. { x: 0, y: 0, width: 4000, height: 2000 }
    this.bounds = options.bounds ?? null;

    // The screen/viewport size — used for centering and bounds clamping
    this.viewWidth = options.viewWidth ?? window.innerWidth;
    this.viewHeight = options.viewHeight ?? window.innerHeight;

    // Internal: the camera's current "eye" position in world space
    this._x = 0;
    this._y = 0;

    // Whether the camera has been placed yet (skips lerp on first frame)
    this._initialized = false;
  }

  // Call this every tick, passing the target's world-space position
  update(targetX, targetY) {
    if (!this._initialized) {
      // First frame: snap directly to target so there's no startup slide
      this._x = targetX;
      this._y = targetY;
      this._initialized = true;
    } else {
      // Lerp: move a fraction of the remaining distance each frame
      // The further away the camera is from the target, the faster it moves
      this._x += (targetX - this._x) * this.lerpFactor;
      this._y += (targetY - this._y) * this.lerpFactor;
    }

    // Convert camera world position into stage pivot + position
    // The stage is shifted so the target stays centered on screen
    let stageX = this.viewWidth  / 2 - this._x;
    let stageY = this.viewHeight / 2 - this._y;

    // Optional: clamp so the camera doesn't show outside the world bounds
    if (this.bounds) {
      const minX = this.viewWidth  - (this.bounds.x + this.bounds.width);
      const minY = this.viewHeight - (this.bounds.y + this.bounds.height);
      const maxX = -this.bounds.x;
      const maxY = -this.bounds.y;

      stageX = Math.min(maxX, Math.max(stageX, minX));
      stageY = Math.min(maxY, Math.max(stageY, minY));
    }

    this.stage.x = stageX;
    this.stage.y = stageY;
  }

  // Instantly snap to a position (useful for scene transitions or respawns)
  snapTo(targetX, targetY) {
    this._x = targetX;
    this._y = targetY;
    this._initialized = true;

    this.stage.x = this.viewWidth  / 2 - this._x;
    this.stage.y = this.viewHeight / 2 - this._y;
  }

  // Change viewport size if the window is resized
  resize(width, height) {
    this.viewWidth  = width;
    this.viewHeight = height;
  }
}