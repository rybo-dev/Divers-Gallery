// TextDistributor.js
// ---------------------------------------------------------------------------
// Accepts one character at a time and distributes them across visible fish.
//
// FLOW:
//   1. receiveCharacter(char) is called — one character per music beat/event.
//   2. If there is no currentFish, the system picks a random visible fish
//      with an empty text slot and makes it the currentFish.
//   3. The character is added to currentFish's text slot.
//   4. If currentFish's slot is now full, the system finds the nearest
//      visible fish with an empty slot and makes that the new currentFish.
//   5. If currentFish leaves the screen or despawns, the system resets
//      and picks a new random visible fish.
//
// SCHOOL RULE:
//   If currentFish belongs to a school, the next fish must also be from
//   that same school (nearest member with an empty slot). Only when all
//   school members have full slots does the system look outside the school.
//
// VIEWPORT:
//   Visibility is checked against the actual camera viewport, not the full
//   scene bounds. A getViewport() function is passed in from loadLevel so
//   the distributor never needs to know about the Camera class directly.
// ---------------------------------------------------------------------------

export class TextDistributor {
    /**
     * @param {FishSpawner} fishSpawner   - Used to get active fish.
     * @param {Function}    getViewport   - Returns the current visible area as
     *                                     { left, right, top, bottom } in world space.
     *                                     Call this every time you need current bounds
     *                                     since the camera moves each frame.
     */
    constructor(fishSpawner, getViewport) {
        this.fishSpawner = fishSpawner;
        this.getViewport = getViewport;

        // The fish currently receiving characters.
        // Null means we need to pick a new one on the next receiveCharacter() call.
        this.currentFish = null;

        // If currentFish is in a school, this holds the school group reference
        // so we can enforce the school rule when picking the next fish.
        this.currentSchoolGroup = null;
    }

    // ---------------------------------------------------------------------------
    // PUBLIC API
    // ---------------------------------------------------------------------------

    /**
     * Receives one character and passes it to the current fish.
     * Call this once per lyric character event from TextAlive (or any source).
     *
     * @param {string} character - A single character to display.
     */
    receiveCharacter(character) {
        if (!character || character.length === 0) return;

        this.validateCurrentFish();

        if (this.currentFish === null) return;

        // Append the character directly — don't overwrite existing text.
        this.currentFish.textSlot.append(character);

        // Check if the slot is now full and we need to move to the next fish.
        const currentLength = this.currentFish.textSlot.currentText.length;
        const capacity      = this.currentFish.textSlot.characterCapacity;

        if (currentLength >= capacity) {
            this.advanceToNextFish();
        }
    }

    /**
     * Call this every frame. Checks if currentFish has gone offscreen
     * or been despawned, and resets if so.
     *
     * @param {number} deltaTime - Seconds since the last frame.
     */
    update(deltaTime) {
        // If there's a current fish, make sure it's still valid.
        // If not, reset so the next character pick starts fresh.
        if (this.currentFish !== null) {
            this.validateCurrentFish();
        }
    }

    // ---------------------------------------------------------------------------
    // INTERNAL — FISH SELECTION
    // ---------------------------------------------------------------------------

    /**
     * Checks whether currentFish is still valid:
     *   - Still active (not despawned)
     *   - Still visible in the camera viewport
     *   - Still has an empty (or partially filled) text slot
     *
     * If any check fails, resets currentFish to null and picks a new one.
     */
    validateCurrentFish() {
        // Check if the current fish has become invalid.
          if (this.currentFish !== null) {
          const isStillActive  = this.currentFish.isActive;
          const isStillVisible = this.isFishInViewport(this.currentFish);

          const currentLength  = this.currentFish.textSlot.currentText.length;
          const capacity       = this.currentFish.textSlot.characterCapacity;
          const slotHasRoom    = currentLength < capacity;

          // Fish is still valid — keep using it.
          if (isStillActive && isStillVisible && slotHasRoom) return;

          // Fish is no longer valid — reset and fall through to pick a new one.
          this.currentFish        = null;
          this.currentSchoolGroup = null;
      }

      // Pick a new random visible fish that has room for at least one character.
      const candidates = this.getVisibleFishWithEmptySlots();
      if (candidates.length === 0) return;

      this.currentFish        = this.pickRandomFish(candidates);
      this.currentSchoolGroup = this.currentFish.schoolGroup ?? null;
    }

    /**
     * Called when currentFish's slot is full.
     * Finds the nearest valid next fish following the school rule,
     * and makes it the new currentFish.
     */
    advanceToNextFish() {
        const previousFish = this.currentFish;

        // --- SCHOOL RULE ---
        // If the current fish is in a school, try to find the nearest
        // empty-slotted member of that same school first.
        if (this.currentSchoolGroup !== null) {
            const emptySchoolmates = this.currentSchoolGroup.members.filter(fish =>
                fish !== previousFish &&          // not the fish we just filled
                fish.hasEmptyTextSlot &&          // has room for more text
                fish.isActive &&                  // not despawned
                this.isFishInViewport(fish)       // visible on screen
            );

            if (emptySchoolmates.length > 0) {
                // Pick the nearest schoolmate.
                this.currentFish = this.findNearestFish(previousFish, emptySchoolmates);
                // currentSchoolGroup stays the same — still in the same school.
                return;
            }

            // All school members are full — fall through to look outside the school.
        }

        // --- LOOK OUTSIDE THE SCHOOL (or no school) ---
        // Find any visible fish with an empty slot, excluding the current school.
        const outsideCandidates = this.getVisibleFishWithEmptySlots().filter(fish =>
            // Exclude members of the school we just exhausted.
            fish.schoolGroup !== this.currentSchoolGroup ||
            this.currentSchoolGroup === null
        );

        if (outsideCandidates.length === 0) {
            // No fish available anywhere — reset so the next character
            // triggers a fresh random pick.
            this.currentFish        = null;
            this.currentSchoolGroup = null;
            return;
        }

        // Pick the nearest fish outside the school.
        this.currentFish        = this.findNearestFish(previousFish, outsideCandidates);
        this.currentSchoolGroup = this.currentFish.schoolGroup ?? null;
    }

    // ---------------------------------------------------------------------------
    // INTERNAL — VIEWPORT CHECK
    // ---------------------------------------------------------------------------

    /**
     * Returns true if the fish's container position falls within the
     * current camera viewport. Uses getViewport() for up-to-date bounds
     * since the camera moves every frame.
     *
     * @param {Fish} fish
     * @returns {boolean}
     */
    isFishInViewport(fish) {
        const viewport = this.getViewport();

        // Use the fish's container position directly — fish and viewport
        // share the same world space (both are inside the same parent container).
        const fishX = fish.container.x;
        const fishY = fish.container.y;

        return (
            fishX >= viewport.left   &&
            fishX <= viewport.right  &&
            fishY >= viewport.top    &&
            fishY <= viewport.bottom
        );
    }

    // ---------------------------------------------------------------------------
    // INTERNAL — HELPERS
    // ---------------------------------------------------------------------------

    /**
     * Returns all active fish that are currently visible in the viewport
     * and have an empty text slot.
     *
     * @returns {Fish[]}
     */
    getVisibleFishWithEmptySlots() {
        return this.fishSpawner.getAllActiveFish().filter(fish =>
            fish.isActive &&
            fish.textSlot.currentText.length < fish.textSlot.characterCapacity &&
            this.isFishInViewport(fish)
        );
    }

    /**
     * Picks a random fish from the given array.
     *
     * @param {Fish[]} fishArray
     * @returns {Fish}
     */
    pickRandomFish(fishArray) {
        const randomIndex = Math.floor(Math.random() * fishArray.length);
        return fishArray[randomIndex];
    }

    /**
     * Finds the fish in candidates closest to referenceFish,
     * measured by straight-line distance between container positions.
     *
     * @param {Fish}   referenceFish
     * @param {Fish[]} candidates
     * @returns {Fish}
     */
    findNearestFish(referenceFish, candidates) {
        let nearestFish      = candidates[0];
        let shortestDistance = referenceFish.distanceTo(candidates[0]);

        for (let i = 1; i < candidates.length; i++) {
            const distance = referenceFish.distanceTo(candidates[i]);
            if (distance < shortestDistance) {
                shortestDistance = distance;
                nearestFish      = candidates[i];
            }
        }

        return nearestFish;
    }
}