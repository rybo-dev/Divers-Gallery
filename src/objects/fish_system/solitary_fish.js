// SolitaryFish.js
// ---------------------------------------------------------------------------
// The behavioral archetype for fish that swim alone (no school).
// This class sits between the base Fish class and specific species classes.
//
// WHAT THIS CLASS ADDS:
//   - A StateMachine that drives solo movement behavior
//   - Three states that all solitary fish share: SWIM, IDLE, TURN
//   - Gentle Y boundary steering so fish don't swim into the surface or floor
//   - Occasional random direction changes to look natural
//
// SPECIES CLASSES (Clownfish, Pufferfish, etc.) extend this and can:
//   - Override or extend the state map to add species-specific states
//   - Pass in their own config values (speed, preferred Y range, etc.)
//   - Add unique behavior in their own update() before calling super.update()
//
// INHERITANCE:
//   Fish → SolitaryFish → Clownfish / Pufferfish / Jellyfish / etc.
// ---------------------------------------------------------------------------

import { Fish } from "./fish.js";
import { StateMachine } from "./statemachine.js";
import { SPAWNER_SETTINGS } from "./fish_config.js";

export class SolitaryFish extends Fish {
  /**
   * @param {Object} speciesConfig - The species entry from fishConfig.js.
   * @param {Bounds} sceneBounds   - The scene's playable area.
   */
  constructor(speciesConfig, sceneBounds) {
    super(speciesConfig, sceneBounds);

    // How long this fish will idle before swimming again (randomized each idle).
    this.idleDuration = 0;

    // How long until this fish makes a slight random Y drift adjustment.
    this.nextYDriftChangeTime = this.randomIdleTime();

    // A small random Y velocity added on top of the main movement,
    // so fish gently bob up and down rather than moving in a straight line.
    this.yDriftVelocity = 0;

    // the target velocity to reach when accelerating
    this.targetVelocityX = 0;

    // -------------------------------------------------------------------------
    // STATE MACHINE
    // Built from a state map defined below in buildStateMap().
    // Species subclasses can pass an extended state map to override this.
    // -------------------------------------------------------------------------
    this.stateMachine = new StateMachine(
      this.buildStateMap(),
      "SWIM",   // all solitary fish start out swimming
      this      // "this" is the owner passed into every state callback
    );
  }

  // ---------------------------------------------------------------------------
  // STATE MAP
  // Returns the state map used by this fish's StateMachine.
  // Species subclasses can override buildStateMap() and call super.buildStateMap()
  // to merge in additional states.
  // ---------------------------------------------------------------------------

  /**
   * Builds and returns the state map for solitary fish movement.
   * Each state has onEnter, onUpdate, and onExit callbacks.
   * The "fish" parameter in each callback is this.owner — i.e. this fish instance.
   *
   * @returns {Object} A state map object for use with StateMachine.
   */
  buildStateMap() {
    return {

      // -----------------------------------------------------------------------
      // SWIM — the fish moves horizontally at its normal speed.
      // This is the default/resting state.
      // -----------------------------------------------------------------------
      SWIM: {
        onEnter: (fish) => {
          // Pick a random swim direction: left (-1) or right (+1).
          // Species that spawn from the left edge will have this overridden
          // by FishSpawner immediately after activation.
          const swimDirection = Math.random() < 0.5 ? 1 : -1;
          fish.targetVelocityX = fish.speciesConfig.normalSwimSpeed * swimDirection;
        },

        onUpdate: (fish, deltaTime) => {
          const acceleration = fish.speciesConfig.acceleration;
          const difference = fish.targetVelocityX - fish.velocityX;
          const step = acceleration * deltaTime;

          if (Math.abs(difference) <= step) {
              // Close enough to snap — prevents endless micro-adjustments.
              fish.velocityX = fish.targetVelocityX;
          } else {
              fish.velocityX += Math.sign(difference) * step;
          }

          // Apply a gentle Y boundary nudge to keep the fish in its depth zone.
          const yNudge = fish.calculateYBoundaryNudge(
            SPAWNER_SETTINGS.yBoundaryRepulsionDistance
          );
          fish.velocityY = yNudge + fish.yDriftVelocity;

          // Periodically change the Y drift to create natural-looking movement.
          fish.nextYDriftChangeTime -= deltaTime;
          if (fish.nextYDriftChangeTime <= 0) {
            fish.yDriftVelocity = (Math.random() - 0.5) * 20; // subtle ±10 px/s drift
            fish.nextYDriftChangeTime = fish.randomIdleTime();
          }

          // Randomly decide to idle briefly.
          // On average, a fish will idle once every 10 seconds.
          if (Math.random() < deltaTime * 0.1) {
            fish.stateMachine.transitionTo("IDLE");
          }
        },

        onExit: (fish) => {
          // Nothing special needed when leaving SWIM.
        },
      },

      // -----------------------------------------------------------------------
      // IDLE — the fish slows to a stop and drifts gently for a moment.
      // -----------------------------------------------------------------------
      IDLE: {
        onEnter: (fish) => {
          // Keep a tiny fraction of the current speed as the idle drift target.
          // The fish decelerates toward this small value rather than zero,
          // so it still creeps slowly in the same direction it was going.
          fish.targetVelocityX = fish.velocityX * 0.2;
          fish.idleDuration = fish.randomIdleTime();
        },

        onUpdate: (fish, deltaTime) => {
          // Decelerate toward zero.
          const acceleration = fish.speciesConfig.acceleration;
          const difference = fish.targetVelocityX - fish.velocityX;
          const step = acceleration * deltaTime;

          if (Math.abs(difference) <= step) {
              fish.velocityX = fish.targetVelocityX;
          } else {
              fish.velocityX += Math.sign(difference) * step;
          }

          // Apply boundary nudge even while idle — fish should never touch walls.
          const yNudge = fish.calculateYBoundaryNudge(
            SPAWNER_SETTINGS.yBoundaryRepulsionDistance
          );
          fish.velocityY = yNudge;

          // Once the idle timer runs out, go back to swimming.
          if (fish.stateMachine.timeInCurrentState >= fish.idleDuration) {
            fish.stateMachine.transitionTo("SWIM");
          }
        },

        onExit: (fish) => {
          // Nothing special needed when leaving IDLE.
        },
      },

      // -----------------------------------------------------------------------
      // TURN — the fish reverses horizontal direction.
      // Triggered when a fish hits a Y boundary and needs to reorient,
      // or when a species-specific state (like FLEE) ends.
      // -----------------------------------------------------------------------
      TURN: {
        onEnter: (fish) => {
          // Reverse direction immediately.
          fish.velocityX = -fish.velocityX;

          // The TURN state is just a brief moment — go straight back to SWIM.
          // We use a tiny idleDuration so it doesn't linger.
          fish.idleDuration = 0.3;
        },

        onUpdate: (fish, deltaTime) => {
          if (fish.stateMachine.timeInCurrentState >= fish.idleDuration) {
            fish.stateMachine.transitionTo("SWIM");
          }
        },

        onExit: (fish) => {
          // Nothing special needed.
        },
      },
    };
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  /**
   * Runs the state machine, then calls the base Fish update to move the container.
   * Species subclasses should call super.update(deltaTime) after their own logic.
   *
   * @param {number} deltaTime - Seconds since the last frame.
   */
  update(deltaTime) {
    if (!this.isActive) return;

    // Run the AI state machine — this updates velocityX and velocityY.
    this.stateMachine.update(deltaTime);

    // Apply movement and update text — defined in the base Fish class.
    super.update(deltaTime);
  }

  // ---------------------------------------------------------------------------
  // POOL RESET
  // ---------------------------------------------------------------------------

  /**
   * Extends the base resetForPool to also reset the state machine.
   */
  resetForPool() {
    super.resetForPool();
    // Return the state machine to its default starting state.
    this.stateMachine.transitionTo("SWIM");
    this.yDriftVelocity = 0;
    this.nextYDriftChangeTime = this.randomIdleTime();
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Returns a random duration (in seconds) for idle pauses and drift changes.
   * Randomizing this prevents all fish from acting in sync.
   *
   * @returns {number} A random time between 1.5 and 4 seconds.
   */
  randomIdleTime() {
    return 1.5 + Math.random() * 2.5;
  }
}