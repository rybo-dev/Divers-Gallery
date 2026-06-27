// FishSpawner.js
// ---------------------------------------------------------------------------
// The FishSpawner is responsible for:
//   1. WEIGHTED SPAWNING  — picking which species to spawn based on rarity weights
//   2. OBJECT POOLING     — reusing fish instances instead of creating new ones
//   3. POPULATION CONTROL — keeping a target number of fish on screen at all times
//   4. DESPAWN / RESPAWN  — detecting when fish leave the scene and replacing them
//   5. PLACEMENT          — placing fish at the correct edge with the right velocity
//
// It does NOT know about text distribution — that's TextDistributor's job.
// It does NOT know about fish AI — that's each fish's own state machine.
//
// OTHER SYSTEMS talk to FishSpawner via:
//   spawner.getVisibleFish()   — returns all active, on-screen fish
//   spawner.getAllActiveFish()  — returns all active fish (on or off screen)
//   spawner.update(dt)         — call this every frame
// ---------------------------------------------------------------------------

import { Bounds } from "./boundaries.js";
import { FISH_SPECIES, FISH_TYPE, SPAWNER_SETTINGS } from "./fish_config.js";

// ---------------------------------------------------------------------------
// SPECIES CLASS REGISTRY
// Maps species id strings to their class constructors.
// When you add a new species class, register it here.
// ---------------------------------------------------------------------------
// import { Clownfish } from "../entities/species/Clownfish.js";
// import { Sardine   } from "../entities/species/Sardine.js";
// import { Pufferfish } from "../entities/species/Pufferfish.js";
// import { Jellyfish  } from "../entities/species/Jellyfish.js";
import { Fish1 } from "./Fish1.js";
import { Fish2 } from "./fish2.js";
// ... add more as you create them


const SPECIES_CLASS_REGISTRY = {
    fish1: Fish1,
    fish2: Fish2
//   clownfish:  Clownfish,
//   sardine:    Sardine,
  // pufferfish: Pufferfish,
  // jellyfish:  Jellyfish,
};

export class FishSpawner {
  /**
   * @param {PIXI.Container} sceneContainer - The PixiJS container to add fish to.
   * @param {Bounds}         sceneBounds    - The playable area boundaries.
   */
  constructor(sceneContainer, sceneBounds, loadedTextures) {
    this.sceneContainer = sceneContainer;
    this.sceneBounds    = sceneBounds;
    this.loadedTextures = loadedTextures;

    // -------------------------------------------------------------------------
    // OBJECT POOLS
    // One pool per species id. Each pool is an array of inactive fish instances
    // ready to be reused. When a fish despawns, it goes here. When a new fish
    // of that species needs to spawn, we check here first before constructing.
    //
    // Structure: { "sardine": [Sardine, Sardine, ...], "clownfish": [...], ... }
    // -------------------------------------------------------------------------
    this.fishPools = {};

    // Initialize an empty pool for each species.
    for (const speciesConfig of FISH_SPECIES) {
      this.fishPools[speciesConfig.id] = [];
    }

    // -------------------------------------------------------------------------
    // ACTIVE TRACKING
    // All fish and groups currently alive in the scene.
    // -------------------------------------------------------------------------

    // All individual fish instances that are currently active (solitary + school members).
    this.activeFishList = [];

    // -------------------------------------------------------------------------
    // WEIGHTED SPAWN TABLE
    // Pre-computed from fishConfig.js so we don't recalculate it every spawn.
    // -------------------------------------------------------------------------
    this.weightedSpawnTable = this.buildWeightedSpawnTable();
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  /**
   * Call this every frame. Checks for offscreen fish, despawns them,
   * and spawns replacements to maintain the target population.
   *
   * @param {number} deltaTime - Seconds since the last frame.
   */
  update(deltaTime) {
    // --- Update all active individual fish ---
    for (const fish of this.activeFishList) {
      fish.update(deltaTime);
    }

    // --- Despawn anything that has left the scene ---
    this.despawnOffscreenFish();

    // --- Spawn new fish if the population is below target ---
    this.maintainTargetPopulation();
  }

  /**
   * Returns all fish that are currently visible on screen.
   * The TextDistributor calls this to get its candidate pool.
   *
   * @returns {Fish[]}
   */
  getVisibleFish() {
    return this.activeFishList.filter(fish => fish.isOnScreen);
  }

  /**
   * Returns every active fish, whether on screen or not.
   * @returns {Fish[]}
   */
  getAllActiveFish() {
    return this.activeFishList;
  }

  // ---------------------------------------------------------------------------
  // POPULATION MANAGEMENT
  // ---------------------------------------------------------------------------

  /**
   * Checks whether the current active fish count is below the target
   * population, and spawns new fish or groups if needed.
   */
  maintainTargetPopulation() {
    const currentFishCount = this.activeFishList.length;

    if (currentFishCount < SPAWNER_SETTINGS.targetPopulation) {
      // Roll a weighted random species.
      const chosenSpeciesConfig = this.rollWeightedSpecies();

      if (chosenSpeciesConfig.fishType === FISH_TYPE.SCHOOL) {
        this.spawnSchoolGroup(chosenSpeciesConfig);
      } else {
        this.spawnSolitaryFish(chosenSpeciesConfig);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // SOLITARY FISH SPAWNING
  // ---------------------------------------------------------------------------

  /**
   * Spawns a single solitary fish from the pool (or creates a new one).
   * Places it just off one of the horizontal edges, swimming inward.
   *
   * @param {Object} speciesConfig - The species entry from fishConfig.js.
   */
  spawnSolitaryFish(speciesConfig) {
    const fish = this.acquireFishFromPool(speciesConfig);

    // Randomly spawn from the left or right edge.
    const spawnFromLeft = Math.random() < 0.5;
    const swimDirection = spawnFromLeft ? 1 : -1; // 1 = right, -1 = left

    const spawnX = spawnFromLeft
      ? this.sceneBounds.leftEdgeX  - SPAWNER_SETTINGS.spawnOffscreenMargin
      : this.sceneBounds.rightEdgeX + SPAWNER_SETTINGS.spawnOffscreenMargin;

    const spawnY = this.randomYWithinPreferredRange(speciesConfig);

    fish.activateAt(spawnX, spawnY);

    // Override the FSM's default swim direction with the correct one.
    fish.velocityX = speciesConfig.normalSwimSpeed * swimDirection;

    // Special placement for clownfish — give them an anemone anchor near their spawn.
    if (speciesConfig.id === "clownfish" && fish.setAnemoneAnchor) {
      // Place the anchor somewhere in the middle of the scene at the same Y.
      const anchorX = this.sceneBounds.leftEdgeX +
        Math.random() * this.sceneBounds.width;
      fish.setAnemoneAnchor(anchorX, spawnY);
    }

    this.activeFishList.push(fish);
    this.sceneContainer.addChild(fish.container);
  }

  // ---------------------------------------------------------------------------
  // SCHOOL GROUP SPAWNING
  // ---------------------------------------------------------------------------

  /**
   * Spawns a full school group: creates all member fish, builds the group,
   * and places the formation center just off one edge.
   *
   * @param {Object} speciesConfig - The species entry from fishConfig.js.
   */
  spawnSchoolGroup(speciesConfig) {
    const schoolSize = this.randomIntBetween(
      speciesConfig.schoolSizeMin,
      speciesConfig.schoolSizeMax
    );

    const spawnFromLeft = Math.random() < 0.5;
    const swimDirection = spawnFromLeft ? 1 : -1;

    const spawnX = spawnFromLeft
      ? this.sceneBounds.leftEdgeX  - SPAWNER_SETTINGS.spawnOffscreenMargin
      : this.sceneBounds.rightEdgeX + SPAWNER_SETTINGS.spawnOffscreenMargin;

    const spawnY = this.randomYWithinPreferredRange(speciesConfig);

    // How many seconds each subsequent fish lags behind the leader's state changes.
    // E.g. a 6-fish school fully transitions in 5 × 0.08 = 0.4 seconds.
    const rippleInterval = 0.08; // seconds per fish

    // Acquire all fish first so we know who the leader is before calling makeFollower.
    const members = [];
    for (let i = 0; i < schoolSize; i++) {
      members.push(this.acquireFishFromPool(speciesConfig));
    }

    // Index 0 is always the leader.
    const leader = members[0];
    leader.makeLeader(swimDirection);

    for (let i = 1; i < members.length; i++) {
      members[i].makeFollower(leader, i * rippleInterval);
    }

    // Place each fish at a random offset within a loose formation around the spawn point.
    const formationRadius = 60; // pixels — how spread out the school starts

    for (let i = 0; i < members.length; i++) {
      const fish = members[i];

      if (i > 0) {
        // Ripple delay grows linearly with index.
        fish.makeFollower(leader, i * rippleInterval);
      }

      // Scatter each fish randomly within the formation radius.
      const offsetX = (Math.random() - 0.5) * 2 * formationRadius;
      const offsetY = (Math.random() - 0.5) * 2 * formationRadius;

      fish.activateAt(spawnX + offsetX, spawnY + offsetY);
      fish.velocityX = speciesConfig.normalSwimSpeed * swimDirection;

      this.activeFishList.push(fish);
      this.sceneContainer.addChild(fish.container);
    }
  }

  // ---------------------------------------------------------------------------
  // DESPAWNING
  // ---------------------------------------------------------------------------

  /**
   * Finds solitary fish that have fully crossed a horizontal boundary,
   * removes them from the scene, and returns them to the pool.
   */
  despawnOffscreenFish() {
    for (let i = this.activeFishList.length - 1; i >= 0; i--) {
      const fish = this.activeFishList[i];

      // For followers: only despawn when their leader is fully offscreen.
      // This keeps the whole school together on despawn.
      if (fish.schoolRole === "follower") {
        if (!fish.schoolLeader || !fish.schoolLeader.isFullyOffscreen()) continue;
      }

      if (fish.isFullyOffscreen()) {
        this.releaseFishToPool(fish);
        this.activeFishList.splice(i, 1);
        this.sceneContainer.removeChild(fish.container);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // OBJECT POOL — ACQUIRE AND RELEASE
  // ---------------------------------------------------------------------------

  /**
   * Returns a fish instance of the given species — either from the pool
   * (if one is available) or freshly constructed (if the pool is empty).
   *
   * @param {Object} speciesConfig
   * @returns {Fish} A fish instance ready to be activated.
   */
  acquireFishFromPool(speciesConfig) {
    const pool = this.fishPools[speciesConfig.id];

    if (pool.length > 0) {
      // Reuse an existing instance from the pool.
      const fish = pool.pop();
      fish.resetForPool(); // wipe any state from its previous life
      return fish;
    }

    // Pool is empty — construct a new fish.
    return this.constructFish(speciesConfig);
  }

  /**
   * Returns a fish to the pool after it despawns.
   * The fish is hidden and reset so it's ready to be reused.
   *
   * @param {Fish} fish
   */
  releaseFishToPool(fish) {
    fish.resetForPool();
    this.fishPools[fish.speciesConfig.id].push(fish);
  }

  /**
   * Constructs a brand new fish instance using the species class registry.
   *
   * @param {Object} speciesConfig
   * @returns {Fish}
   */
  constructFish(speciesConfig) {
    const SpeciesClass = SPECIES_CLASS_REGISTRY[speciesConfig.id];

    if (!SpeciesClass) {
      console.error(
        `FishSpawner: No class found for species id "${speciesConfig.id}". ` +
        `Make sure it is registered in SPECIES_CLASS_REGISTRY inside FishSpawner.js.`
      );
      return null;
    }

    return new SpeciesClass(speciesConfig, this.sceneBounds, this.loadedTextures);
  }

  // ---------------------------------------------------------------------------
  // WEIGHTED RANDOM SPECIES SELECTION
  // ---------------------------------------------------------------------------

  /**
   * Builds the weighted spawn table once at construction time.
   * The table is an array of { speciesConfig, cumulativeWeight } entries.
   *
   * Example with weights [40, 25, 20, 5]:
   *   totalWeight = 90
   *   Table: [{ ..., cumulative: 40 }, { ..., cumulative: 65 }, { ..., cumulative: 85 }, { ..., cumulative: 90 }]
   *
   * To pick a species, roll a random number 0–90 and find the first entry
   * whose cumulativeWeight is >= the roll.
   *
   * @returns {Array<{ speciesConfig: Object, cumulativeWeight: number }>}
   */
  buildWeightedSpawnTable() {
    const table = [];
    let runningTotal = 0;

    for (const speciesConfig of FISH_SPECIES) {
      // Only include species that have a registered class.
      if (!SPECIES_CLASS_REGISTRY[speciesConfig.id]) continue;

      runningTotal += speciesConfig.spawnWeight;
      table.push({ speciesConfig, cumulativeWeight: runningTotal });
    }

    return table;
  }

  /**
   * Rolls a weighted random species from the spawn table.
   * Rare species (low spawnWeight) are selected infrequently but possible.
   *
   * @returns {Object} A species config from fishConfig.js.
   */
  rollWeightedSpecies() {
    const totalWeight = this.weightedSpawnTable[this.weightedSpawnTable.length - 1].cumulativeWeight;
    const roll = Math.random() * totalWeight;

    // Walk the table until we find the first entry whose cumulative weight
    // is greater than or equal to our roll.
    for (const entry of this.weightedSpawnTable) {
      if (roll <= entry.cumulativeWeight) {
        return entry.speciesConfig;
      }
    }

    // Fallback — should never reach here, but just in case.
    return this.weightedSpawnTable[0].speciesConfig;
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Picks a random Y position within the species' preferred depth range.
   * Uses Bounds.fractionToY() to convert the 0–1 fraction to actual pixels.
   *
   * @param {Object} speciesConfig
   * @returns {number} A Y pixel coordinate within the species' preferred range.
   */
  randomYWithinPreferredRange(speciesConfig) {
    const [minFraction, maxFraction] = speciesConfig.preferredYRange;
    const randomFraction = minFraction + Math.random() * (maxFraction - minFraction);
    return this.sceneBounds.fractionToY(randomFraction);
  }

  /**
   * Returns a random integer between min and max (inclusive).
   *
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  randomIntBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}