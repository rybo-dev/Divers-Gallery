// StateMachine.js
// ---------------------------------------------------------------------------
// A generic Finite State Machine (FSM).
// Fish AI is driven by this — each species passes in its own set of states
// and this class handles all the bookkeeping of entering, updating, and
// exiting states.
//
// HOW IT WORKS:
//   You define a map of states. Each state is an object with three optional
//   callback functions:
//     onEnter(fish)  — called once when this state becomes active
//     onUpdate(fish, deltaTime) — called every frame while this state is active
//     onExit(fish)   — called once when leaving this state
//
//   To change states, call transitionTo("stateName").
//   The FSM calls onExit on the old state, then onEnter on the new one.
//
// EXAMPLE STATE MAP:
//   {
//     IDLE: {
//       onEnter: (fish) => { fish.velocity.x = 0; },
//       onUpdate: (fish, dt) => { ... check if should start swimming ... },
//       onExit:  (fish) => { ... }
//     },
//     SWIM: {
//       onEnter:  (fish) => { fish.velocity.x = fish.swimSpeed; },
//       onUpdate: (fish, dt) => { ... },
//       onExit:   (fish) => { ... }
//     }
//   }
// ---------------------------------------------------------------------------

export class StateMachine {
  /**
   * @param {Object} stateMap      - All possible states keyed by state name string.
   * @param {string} initialState  - The name of the state to start in.
   * @param {Object} owner         - The fish (or group) this FSM belongs to.
   *                                 Passed into every callback so states can
   *                                 read and modify the owner's properties.
   */
  constructor(stateMap, initialState, owner) {
    this.stateMap = stateMap;
    this.owner = owner;

    // The name of the state we are currently in (a string like "IDLE").
    this.currentStateName = null;

    // The actual state object (with onEnter / onUpdate / onExit) currently active.
    this.currentState = null;

    // How long (in seconds) we have been in the current state.
    // Useful for states that want to time out after N seconds.
    this.timeInCurrentState = 0;

    // Start the machine in the initial state.
    this.transitionTo(initialState);
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  /**
   * Call this every frame from the fish's update() method.
   * Runs the current state's onUpdate callback and tracks elapsed time.
   *
   * @param {number} deltaTime - Seconds since the last frame.
   */
  update(deltaTime) {
    this.timeInCurrentState += deltaTime;

    if (this.currentState && this.currentState.onUpdate) {
      this.currentState.onUpdate(this.owner, deltaTime);
    }
  }

  /**
   * Switch to a different state.
   * Calls onExit on the current state (if any), then onEnter on the new state.
   *
   * @param {string} newStateName - The key in stateMap to transition to.
   */
  transitionTo(newStateName) {
    // Guard: do nothing if we are already in this state.
    if (newStateName === this.currentStateName) return;

    // Guard: make sure the requested state actually exists.
    if (!this.stateMap[newStateName]) {
      console.warn(
        `StateMachine: tried to transition to unknown state "${newStateName}".`
      );
      return;
    }

    // --- Exit the current state ---
    if (this.currentState && this.currentState.onExit) {
      this.currentState.onExit(this.owner);
    }

    // --- Switch over ---
    this.currentStateName = newStateName;
    this.currentState = this.stateMap[newStateName];
    this.timeInCurrentState = 0; // reset the timer for the new state

    // --- Enter the new state ---
    if (this.currentState.onEnter) {
      this.currentState.onEnter(this.owner);
    }
  }

  /**
   * Convenience getter — lets other systems ask "is this fish currently fleeing?"
   * without reaching into the FSM internals directly.
   *
   * @param {string} stateName
   * @returns {boolean}
   */
  isInState(stateName) {
    return this.currentStateName === stateName;
  }
}