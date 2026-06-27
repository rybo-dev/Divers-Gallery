// SchoolFish.js
// ---------------------------------------------------------------------------
// Behavioral class for fish that move in a school.
//
// One fish in the group is the LEADER — it runs a StateMachine that drives
// the group's shared decisions: when to swim, when to turn, when to idle.
//
// Every other fish is a FOLLOWER — it watches the leader's current state and
// mirrors it, but only after a short per-fish ripple delay. This makes the
// whole school shift direction in a wave rather than all at once.
//
// During IDLE, followers ignore the leader and drift in their own random
// direction, which causes the school to spread out slightly — then when SWIM
// resumes they pull back together.
//
// STATES (leader only):
//   SWIM  — move horizontally at normalSwimSpeed for a random time
//   TURN  — decelerate, flip direction, brief pause
//   IDLE  — near-zero velocity for a random duration
//
// INHERITANCE:
//   Fish → SchoolFish → Fish2 / Sardine / etc.
// ---------------------------------------------------------------------------

import { Fish } from "./fish.js";
import { StateMachine } from "./statemachine.js";
import { SPAWNER_SETTINGS } from "./fish_config.js";

export class SchoolFish extends Fish {
  /**
   * @param {Object} speciesConfig - The species entry from fishConfig.js.
   * @param {Bounds} sceneBounds   - The scene's playable area.
   */
  constructor(speciesConfig, sceneBounds) {
    super(speciesConfig, sceneBounds);

    // -------------------------------------------------------------------------
    // ROLE — set by FishSpawner after construction
    // -------------------------------------------------------------------------

    // "leader" or "follower". Assigned by FishSpawner.
    this.schoolRole = "follower";

    // The leader fish instance. Followers read this every frame.
    // On the leader itself, this points to itself (avoids null checks).
    this.schoolLeader = null;

    // How many seconds after the leader changes state this fish reacts.
    // 0 for the leader; memberIndex * rippleInterval for followers.
    this.rippleDelay = 0;

    // -------------------------------------------------------------------------
    // SHARED DIRECTION — written by the leader's state machine
    // -------------------------------------------------------------------------

    // 1 = swimming right, -1 = swimming left.
    // The leader owns this value; followers copy it (after their ripple delay).
    this.swimDirection = 1;

    // -------------------------------------------------------------------------
    // LEADER — state machine fields
    // -------------------------------------------------------------------------

    // How long the leader will swim before deciding to turn or idle.
    this.swimDuration = 0;

    // How long the leader will idle before swimming again.
    this.idleDuration = 0;

    // The state machine. Only constructed for the leader (see makeLeader()).
    this.stateMachine = null;

    // -------------------------------------------------------------------------
    // FOLLOWER — ripple tracking
    // -------------------------------------------------------------------------

    // Snapshot of the leader's state at the moment the follower last synced.
    // Used to detect when the leader changed state so the ripple timer can start.
    this.lastKnownLeaderState = null;

    // Counts down from rippleDelay to 0 after the leader changes state.
    // While > 0 the follower keeps behaving as if the leader is still in
    // the previous state.
    this.rippleCountdown = 0;

    // The state the follower is currently acting on (may lag behind the leader).
    this.activeState = "SWIM";

    // -------------------------------------------------------------------------
    // IDLE DRIFT — used by both leader and followers during IDLE
    // -------------------------------------------------------------------------

    // A small random velocity applied during idle so the fish looks alive.
    // Each fish picks its own, so the school spreads out during idle.
    this.idleDriftX = 0;
    this.idleDriftY = 0;

    // How long until this fish re-randomizes its idle drift direction.
    this.nextDriftChangeTime = 0;

    // -------------------------------------------------------------------------
    // Y DRIFT — gentle vertical bobbing during SWIM (same as SolitaryFish)
    // -------------------------------------------------------------------------

    this.yDriftVelocity = 0;
    this.nextYDriftChangeTime = this.randomTime(1.5, 4);
  }

  // ---------------------------------------------------------------------------
  // SETUP — called by FishSpawner after construction
  // ---------------------------------------------------------------------------

  /**
   * Promotes this fish to leader and builds its state machine.
   * Call this on exactly one fish in the school before activating.
   *
   * @param {number} initialDirection - 1 for right, -1 for left.
   */
  makeLeader(initialDirection) {
    this.schoolRole   = "leader";
    this.schoolLeader = this; // leader points to itself for uniform reads
    this.swimDirection = initialDirection;
    this.activeState   = "SWIM";

    this.stateMachine = new StateMachine(
      this.buildLeaderStateMap(),
      "SWIM",
      this
    );
  }

  /**
   * Sets up this fish as a follower of the given leader.
   *
   * @param {SchoolFish} leader       - The leader fish.
   * @param {number}     rippleDelay  - Seconds to lag behind the leader's state changes.
   */
  makeFollower(leader, rippleDelay) {
    this.schoolRole          = "follower";
    this.schoolLeader        = leader;
    this.rippleDelay         = rippleDelay;
    this.swimDirection       = leader.swimDirection;
    this.activeState         = leader.activeState;
    this.lastKnownLeaderState = leader.stateMachine
      ? leader.stateMachine.currentStateName
      : "SWIM";
    this.rippleCountdown     = 0;
    
    // Snap to swimming velocity immediately so followers don't start from zero.
    this.velocityX = this.speciesConfig.normalSwimSpeed * this.swimDirection;
    this.velocityY = 0;
  }

  // ---------------------------------------------------------------------------
  // LEADER STATE MAP
  // ---------------------------------------------------------------------------

  buildLeaderStateMap() {
    return {

      // -----------------------------------------------------------------------
      // SWIM — move in swimDirection for a random amount of time
      // -----------------------------------------------------------------------
      SWIM: {
        onEnter: (fish) => {
          // Pick how long to swim this time before doing something else.
          fish.swimDuration = fish.randomTime(1, 6);

          // Accelerate toward full speed in the current direction.
          // (velocityX is set gradually each frame in onUpdate, not snapped here)
        },

        onUpdate: (fish, deltaTime) => {
          const targetVelocityX = fish.speciesConfig.normalSwimSpeed * fish.swimDirection;
          fish.velocityX = fish.lerpVelocity(fish.velocityX, targetVelocityX, deltaTime);

          // Gentle boundary nudge + Y drift, same pattern as SolitaryFish.
          const yNudge = fish.calculateYBoundaryNudge(
            SPAWNER_SETTINGS.yBoundaryRepulsionDistance
          );
          fish.nextYDriftChangeTime -= deltaTime;
          if (fish.nextYDriftChangeTime <= 0) {
            fish.yDriftVelocity = (Math.random() - 0.5) * 20;
            fish.nextYDriftChangeTime = fish.randomTime(1.5, 4);
          }
          fish.velocityY = yNudge + fish.yDriftVelocity;

          // After swimDuration elapses, randomly choose to turn or idle.
          if (fish.stateMachine.timeInCurrentState >= fish.swimDuration) {
            const nextState = Math.random() < 0.6 ? "TURN" : "IDLE";
            fish.stateMachine.transitionTo(nextState);
          }
        },

        onExit: (fish) => {},
      },

      // -----------------------------------------------------------------------
      // TURN — decelerate, flip direction, hold briefly, then idle or swim
      // -----------------------------------------------------------------------
      TURN: {
        onEnter: (fish) => {
          // Flip the shared direction. Followers will pick this up after their
          // ripple delay expires.
          fish.swimDirection = -fish.swimDirection;

          // Brief pause in the turned state before resuming.
          fish.idleDuration = fish.randomTime(0.2, 0.6);
        },

        onUpdate: (fish, deltaTime) => {
          // Decelerate toward zero during the turn.
          fish.velocityX = fish.lerpVelocity(fish.velocityX, 0, deltaTime);

          const yNudge = fish.calculateYBoundaryNudge(
            SPAWNER_SETTINGS.yBoundaryRepulsionDistance
          );
          fish.velocityY = yNudge;

          if (fish.stateMachine.timeInCurrentState >= fish.idleDuration) {
            fish.stateMachine.transitionTo("IDLE");
          }
        },

        onExit: (fish) => {},
      },

      // -----------------------------------------------------------------------
      // IDLE — slow drift, each fish wanders independently for a moment
      // -----------------------------------------------------------------------
      IDLE: {
        onEnter: (fish) => {
          fish.idleDuration = fish.randomTime(2, 5);
          // Leader picks its own idle drift just like followers will.
          fish.pickNewIdleDrift();
        },

        onUpdate: (fish, deltaTime) => {
          // Decelerate the horizontal swim velocity toward idle drift speed.
          fish.velocityX = fish.lerpVelocity(fish.velocityX, fish.idleDriftX, deltaTime);

          const yNudge = fish.calculateYBoundaryNudge(
            SPAWNER_SETTINGS.yBoundaryRepulsionDistance
          );
          fish.velocityY = yNudge + fish.idleDriftY;

          // Periodically re-randomize the drift direction.
          fish.nextDriftChangeTime -= deltaTime;
          if (fish.nextDriftChangeTime <= 0) {
            fish.pickNewIdleDrift();
          }

          if (fish.stateMachine.timeInCurrentState >= fish.idleDuration) {
            fish.stateMachine.transitionTo("SWIM");
          }
        },

        onExit: (fish) => {},
      },
    };
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  update(deltaTime) {
    if (!this.isActive) return;

    if (this.schoolRole === "leader") {
      this.updateAsLeader(deltaTime);
    } else {
      this.updateAsFollower(deltaTime);
    }

    // Apply velocity to position, flip sprite, update text label.
    super.update(deltaTime);
  }

  // --- Leader update ---

  updateAsLeader(deltaTime) {
    // The state machine writes to velocityX / velocityY via onUpdate callbacks.
    this.stateMachine.update(deltaTime);
    // activeState is kept in sync so followers can read it.
    this.activeState = this.stateMachine.currentState;
  }

  // --- Follower update ---

  updateAsFollower(deltaTime) {
    const leader = this.schoolLeader;

    // null guard
    if (!leader || !leader.stateMachine) return;

    // Detect when the leader has changed state since we last checked.
    const leaderCurrentState = leader.stateMachine.currentStateName;
    if (leaderCurrentState !== this.lastKnownLeaderState) {
      // Leader just changed — start the ripple countdown for this fish.
      this.lastKnownLeaderState = leaderCurrentState;
      this.rippleCountdown = this.rippleDelay;
    }

    // Tick down the ripple countdown.
    if (this.rippleCountdown > 0) {
      this.rippleCountdown -= deltaTime;
      if (this.rippleCountdown <= 0) {
        // Ripple delay expired — adopt the leader's current state now.
        this.rippleCountdown = 0;
        this.activeState = leaderCurrentState;

        // If we just entered IDLE, pick our own drift so we spread out.
        if (this.activeState === "IDLE") {
          this.pickNewIdleDrift();
        }

        // Sync swim direction from the leader when we adopt SWIM or TURN.
        if (this.activeState === "SWIM" || this.activeState === "TURN") {
          this.swimDirection = leader.swimDirection;
        }
      }
    }

    // Behave according to the state this follower is currently acting on.
    switch (this.activeState) {

      case "SWIM": {
        const targetVelocityX = this.speciesConfig.normalSwimSpeed * this.swimDirection;
        this.velocityX = this.lerpVelocity(this.velocityX, targetVelocityX, deltaTime);

        const yNudge = this.calculateYBoundaryNudge(
          SPAWNER_SETTINGS.yBoundaryRepulsionDistance
        );
        this.nextYDriftChangeTime -= deltaTime;
        if (this.nextYDriftChangeTime <= 0) {
          this.yDriftVelocity = (Math.random() - 0.5) * 20;
          this.nextYDriftChangeTime = this.randomTime(1.5, 4);
        }
        this.velocityY = yNudge + this.yDriftVelocity;
        break;
      }

      case "TURN": {
        this.velocityX = this.lerpVelocity(this.velocityX, 0, deltaTime);
        const yNudge = this.calculateYBoundaryNudge(
          SPAWNER_SETTINGS.yBoundaryRepulsionDistance
        );
        this.velocityY = yNudge;
        break;
      }

      case "IDLE": {
        this.velocityX = this.lerpVelocity(this.velocityX, this.idleDriftX, deltaTime);
        const yNudge = this.calculateYBoundaryNudge(
          SPAWNER_SETTINGS.yBoundaryRepulsionDistance
        );
        this.velocityY = yNudge + this.idleDriftY;

        // Re-randomize drift on this fish's own schedule.
        this.nextDriftChangeTime -= deltaTime;
        if (this.nextDriftChangeTime <= 0) {
          this.pickNewIdleDrift();
        }
        break;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // POOL RESET
  // ---------------------------------------------------------------------------

  resetForPool() {
    super.resetForPool();

    this.schoolRole          = "follower";
    this.schoolLeader        = null;
    this.rippleDelay         = 0;
    this.rippleCountdown     = 0;
    this.swimDirection       = 1;
    this.activeState         = "SWIM";
    this.lastKnownLeaderState = null;
    this.stateMachine        = null;
    this.idleDriftX          = 0;
    this.idleDriftY          = 0;
    this.yDriftVelocity      = 0;
    this.nextYDriftChangeTime = this.randomTime(1.5, 4);
    this.nextDriftChangeTime  = 0;
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Smoothly moves currentVelocity toward targetVelocity using the species'
   * acceleration value. Returns the new velocity.
   *
   * @param {number} currentVelocity
   * @param {number} targetVelocity
   * @param {number} deltaTime
   * @returns {number}
   */
  lerpVelocity(currentVelocity, targetVelocity, deltaTime) {
    const acceleration = this.speciesConfig.acceleration;
    const difference   = targetVelocity - currentVelocity;
    const step         = acceleration * deltaTime;

    if (Math.abs(difference) <= step) {
      return targetVelocity; // close enough — snap to avoid micro-jitter
    }
    return currentVelocity + Math.sign(difference) * step;
  }

  /**
   * Picks a new random idle drift velocity for this fish.
   * Very slow — just enough to make the fish look alive and spread the school.
   */
  pickNewIdleDrift() {
    const maxIdleDrift = 12; // pixels per second — very gentle
    this.idleDriftX = (Math.random() - 0.5) * maxIdleDrift;
    this.idleDriftY = (Math.random() - 0.5) * maxIdleDrift;
    this.nextDriftChangeTime = this.randomTime(1, 3);
  }

  /**
   * Returns a random number between min and max (inclusive).
   *
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  randomTime(min, max) {
    return min + Math.random() * (max - min);
  }
}