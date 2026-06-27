// TextSlot.js
// ---------------------------------------------------------------------------
// Each fish has one TextSlot — a fixed-size text buffer with a display timer.
//
// The TextDistributor fills these slots by calling receive().
// The slot then displays the text for a set duration, fades it out,
// and resets itself so the fish is ready to receive new text.
//
// STATES this slot moves through automatically:
//   EMPTY   → text arrives via receive()
//   VISIBLE → text is shown at full opacity, timer counts down
//   FADING  → opacity drops to 0 over the fade duration
//   EMPTY   → back to start, ready for new text
// ---------------------------------------------------------------------------

// The four internal display states of a text slot.
const SLOT_STATE = {
  EMPTY:   "EMPTY",
  VISIBLE: "VISIBLE",
  FADING:  "FADING",
};

export class TextSlot {
  /**
   * @param {number} characterCapacity  - Maximum number of characters this slot
   *                                      can hold. When the distributor fills fish,
   *                                      it will never send more than this many chars.
   * @param {number} displayDuration    - How many seconds the text stays fully visible
   *                                      before it starts fading. Default: 3 seconds.
   * @param {number} fadeDuration       - How many seconds the fade-out takes.
   *                                      Default: 1 second.
   */
  constructor(characterCapacity, displayDuration = 3, fadeDuration = 1) {
    this.characterCapacity = characterCapacity;

    this.displayDuration = displayDuration;
    this.fadeDuration = fadeDuration;

    // The text currently stored in this slot. Empty string means the slot is free.
    this.currentText = "";

    // Internal state — drives the display lifecycle.
    this.displayState = SLOT_STATE.EMPTY;

    // Counts down while in VISIBLE state.
    this.displayTimeRemaining = 0;

    // Counts down while in FADING state.
    this.fadeTimeRemaining = 0;

    // Current opacity of the text, 0 (invisible) to 1 (fully visible).
    // Your rendering code should read this and apply it to the PixiJS text object.
    this.currentOpacity = 0;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  /**
   * Returns true if this slot has no text and is not currently fading out.
   * The TextDistributor checks this before deciding to fill a fish.
   */
  get isEmpty() {
    return this.displayState === SLOT_STATE.EMPTY;
  }

  /**
   * Called by TextDistributor to give this slot some text.
   * Does nothing if the slot already has text — the distributor should check
   * isEmpty() before calling this.
   *
   * @param {string} text - The text to display. Will be trimmed to characterCapacity
   *                        as a safety measure, but the distributor should already
   *                        be chunking correctly.
   */
  receive(text) {
    if (!this.isEmpty) {
      console.warn("TextSlot.receive() called on a slot that is not empty. Ignoring.");
      return;
    }

    this.currentText = text.slice(0, this.characterCapacity);
    this.displayState = SLOT_STATE.VISIBLE;
    this.displayTimeRemaining = this.displayDuration;
    this.currentOpacity = 1;
  }

  /**
   * Appends a single character to the current text.
   * If the slot is empty, this also starts the display timer.
   * Does nothing if the slot is already at capacity.
   *
   * @param {string} character - A single character to add.
   */
  append(character) {
      if (this.currentText.length >= this.characterCapacity) return;

      // If this is the first character, activate the slot.
      if (this.displayState === SLOT_STATE.EMPTY) {
          this.displayState = SLOT_STATE.VISIBLE;
          this.displayTimeRemaining = this.displayDuration;
          this.currentOpacity = 1;
      }

      this.currentText += character;
  }

  /**
   * Call this every frame from the fish's update() method.
   * Advances the display timer and fade, then resets when done.
   *
   * @param {number} deltaTime - Seconds since the last frame.
   */
  update(deltaTime) {
    if (this.displayState === SLOT_STATE.EMPTY) return; // nothing to do

    if (this.displayState === SLOT_STATE.VISIBLE) {
      this.displayTimeRemaining -= deltaTime;

      // Time's up — start fading out.
      if (this.displayTimeRemaining <= 0) {
        this.displayState = SLOT_STATE.FADING;
        this.fadeTimeRemaining = this.fadeDuration;
      }
    }

    if (this.displayState === SLOT_STATE.FADING) {
      this.fadeTimeRemaining -= deltaTime;

      // Calculate opacity as a 0–1 fraction of the fade that is left.
      // When fadeTimeRemaining equals fadeDuration, opacity is 1.
      // When fadeTimeRemaining reaches 0, opacity is 0.
      this.currentOpacity = Math.max(0, this.fadeTimeRemaining / this.fadeDuration);

      // Fade is complete — clear everything and return to EMPTY.
      if (this.fadeTimeRemaining <= 0) {
        this.clear();
      }
    }
  }

  /**
   * Immediately wipes all text and resets the slot to EMPTY.
   * Called automatically when a fade completes, but can also be
   * called manually (e.g. when a fish despawns and returns to the pool).
   */
  clear() {
    this.currentText = "";
    this.displayState = SLOT_STATE.EMPTY;
    this.displayTimeRemaining = 0;
    this.fadeTimeRemaining = 0;
    this.currentOpacity = 0;
  }
}