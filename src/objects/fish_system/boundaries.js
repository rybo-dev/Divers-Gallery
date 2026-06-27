// Bounds.js
// ---------------------------------------------------------------------------
// A plain data object that describes the playable area of the underwater scene.
// Every system that needs to know "where are the walls?" receives one of these.
// Nothing in here does logic — it is purely a container for four numbers.
// ---------------------------------------------------------------------------

export class Bounds {
  /**
   * @param {number} leftEdgeX     - The x coordinate of the left scene boundary.
   *                                 Fish that fully cross this despawn.
   * @param {number} rightEdgeX    - The x coordinate of the right scene boundary.
   *                                 Fish that fully cross this despawn.
   * @param {number} surfaceY      - The y coordinate of the sea surface.
   *                                 Fish must stay below this line.
   * @param {number} seaFloorY     - The y coordinate of the sea floor.
   *                                 Fish must stay above this line.
   */
  constructor(leftEdgeX, rightEdgeX, surfaceY, seaFloorY) {
    this.leftEdgeX = leftEdgeX;
    this.rightEdgeX = rightEdgeX;
    this.surfaceY = surfaceY;
    this.seaFloorY = seaFloorY;
  }

  // ---------------------------------------------------------------------------
  // Convenience getters so other systems can ask for dimensions without math.
  // ---------------------------------------------------------------------------

  /** Total width of the playable area in pixels. */
  get width() {
    return this.rightEdgeX - this.leftEdgeX;
  }

  /** Total height of the playable area in pixels. */
  get height() {
    return this.seaFloorY - this.surfaceY;
  }

  /**
   * Converts a 0–1 fraction into an actual Y pixel position within the scene.
   * Useful for species configs that say "I prefer the middle third of the water"
   * without hardcoding pixel values.
   *
   * Example: fractionToY(0.5) returns the exact vertical midpoint of the scene.
   *
   * @param {number} fraction - A value between 0 (surface) and 1 (sea floor).
   * @returns {number} The corresponding Y pixel coordinate.
   */
  fractionToY(fraction) {
    return this.surfaceY + fraction * this.height;
  }
}