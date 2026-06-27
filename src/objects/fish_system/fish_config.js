// fishConfig.js
// ---------------------------------------------------------------------------
// The single source of truth for every fish species in the game.
// If you want to add a new fish, tweak a spawn rate, or change how many
// characters a fish can hold — this is the only file you touch.
//
// HOW TO READ preferredYRange:
//   Values are fractions of the scene height, where 0 = sea surface, 1 = sea floor.
//   [0.1, 0.4] means "I swim in the upper 10%–40% of the water column."
//   Bounds.fractionToY() converts these into actual pixel positions at runtime.
//
// HOW spawnWeight WORKS:
//   All weights are added together. Each species' chance of spawning is:
//     its weight / total of all weights
//   Example: sardine=40, clownfish=25, pufferfish=20, oarfish=5 → total=90
//   Oarfish spawn chance = 5/90 ≈ 5.5% of the time.
//
// HOW textSlotCapacity WORKS:
//   This is the max number of characters a fish of this species can display
//   at once. The TextDistributor will never send more than this many chars.
// ---------------------------------------------------------------------------

export const FISH_TYPE = {
  SOLITARY: "SOLITARY", // Fish that swim alone
  SCHOOL:   "SCHOOL",   // Fish that swim in groups
};

// ---------------------------------------------------------------------------
// SPECIES DEFINITIONS
// Each entry here corresponds to one species class in /entities/species/.
// The "id" must exactly match the class filename (e.g. "sardine" → Sardine.js).
// ---------------------------------------------------------------------------

export const FISH_SPECIES = [

  // MY FISHES
   {
      id: "fish1",
      displayName: "Fish1",
      fishType: FISH_TYPE.SOLITARY,

      spawnWeight: 30,

      spriteScale: 0.1,

      schoolSizeMin: null,
      schoolSizeMax: null,

      preferredYRange: [0.2, 0.8],

      textSlotCapacity: 1,
      textDisplayDuration: 3,
      textFadeDuration: 1,

      normalSwimSpeed: 70,
      fastSwimSpeed: 160,
      acceleration: 80,

      // Must match the key registered in manifest.json for the fishes bundle.
      spriteKey: "fish1",
  },

  {
    id: "fish2",
    displayName: "Fish2",
    fishType: FISH_TYPE.SCHOOL,

    spawnWeight: 3,

    spriteScale: 0.1,

    schoolSizeMin: 4,
    schoolSizeMax: 6,

    preferredYRange: [0.3, 0.65],

    textSlotCapacity: 1,

    textDisplayDuration: 3,
    textFadeDuration: 1,

    normalSwimSpeed: 150,      // pixels per second when calmly swimming
    fastSwimSpeed: 200,       // pixels per second when fleeing or startled
    acceleration: 120,

    spriteKey: "fish2",
  },
  // Below are examples

  // ---- COMMON SPECIES -------------------------------------------------------

  {
    id: "sardine",
    displayName: "Sardine",
    fishType: FISH_TYPE.SCHOOL,

    // How likely this species is to be chosen when a new spawn rolls.
    spawnWeight: 40,

    // Sardines school in groups of 8–15 fish.
    schoolSizeMin: 8,
    schoolSizeMax: 15,

    // Sardines are mid-water fish.
    preferredYRange: [0.3, 0.65],

    // Each sardine can only hold a few characters — they're small fish.
    textSlotCapacity: 4,

    // How long the text stays visible before fading (seconds).
    textDisplayDuration: 3,
    textFadeDuration: 1,

    // Movement properties.
    normalSwimSpeed: 80,      // pixels per second when calmly swimming
    fastSwimSpeed: 200,       // pixels per second when fleeing or startled

    // Sprite sheet key (matches your PixiJS asset bundle key).
    spriteKey: "fish_sardine",
  },

  {
    id: "clownfish",
    displayName: "Clownfish",
    fishType: FISH_TYPE.SOLITARY,

    spawnWeight: 25,

    // No school size needed for solitary fish.
    schoolSizeMin: null,
    schoolSizeMax: null,

    // Clownfish stay near the bottom where anemones are.
    preferredYRange: [0.65, 0.9],

    // Clownfish are a bit larger — can hold more text.
    textSlotCapacity: 6,
    textDisplayDuration: 3.5,
    textFadeDuration: 1,

    normalSwimSpeed: 60,
    fastSwimSpeed: 150,

    spriteKey: "fish_clownfish",
  },

  {
    id: "pufferfish",
    displayName: "Pufferfish",
    fishType: FISH_TYPE.SOLITARY,

    spawnWeight: 20,

    schoolSizeMin: null,
    schoolSizeMax: null,

    // Pufferfish roam the middle of the water column.
    preferredYRange: [0.35, 0.75],

    // Larger body = more text capacity.
    textSlotCapacity: 8,
    textDisplayDuration: 4,
    textFadeDuration: 1.2,

    // Pufferfish are slow by nature.
    normalSwimSpeed: 40,
    fastSwimSpeed: 100,

    spriteKey: "fish_pufferfish",
  },

  {
    id: "jellyfish",
    displayName: "Jellyfish",
    fishType: FISH_TYPE.SOLITARY,

    spawnWeight: 15,

    schoolSizeMin: null,
    schoolSizeMax: null,

    // Jellyfish drift near the surface.
    preferredYRange: [0.05, 0.35],

    textSlotCapacity: 5,
    textDisplayDuration: 4,
    textFadeDuration: 1.5,

    // Jellyfish don't really "swim" — they drift very slowly.
    normalSwimSpeed: 20,
    fastSwimSpeed: 20, // jellyfish can't flee — same speed no matter what

    spriteKey: "fish_jellyfish",
  },

  // ---- UNCOMMON SPECIES -----------------------------------------------------

  {
    id: "turtle",
    displayName: "Sea Turtle",
    fishType: FISH_TYPE.SOLITARY,

    spawnWeight: 8,

    schoolSizeMin: null,
    schoolSizeMax: null,

    // Turtles roam the full water column.
    preferredYRange: [0.1, 0.85],

    // Large body — can hold a lot of text.
    textSlotCapacity: 12,
    textDisplayDuration: 5,
    textFadeDuration: 1.5,

    normalSwimSpeed: 50,
    fastSwimSpeed: 120,

    spriteKey: "fish_turtle",
  },

  {
    id: "manta_ray",
    displayName: "Manta Ray",
    fishType: FISH_TYPE.SOLITARY,

    spawnWeight: 6,

    schoolSizeMin: null,
    schoolSizeMax: null,

    // Manta rays glide through the upper-middle water.
    preferredYRange: [0.15, 0.55],

    textSlotCapacity: 10,
    textDisplayDuration: 4,
    textFadeDuration: 1.2,

    normalSwimSpeed: 90,
    fastSwimSpeed: 180,

    spriteKey: "fish_manta_ray",
  },

  // ---- RARE SPECIES ---------------------------------------------------------

  {
    id: "whale_shark",
    displayName: "Whale Shark",
    fishType: FISH_TYPE.SOLITARY,

    spawnWeight: 4,

    schoolSizeMin: null,
    schoolSizeMax: null,

    // Whale sharks are massive — they cruise the mid-to-upper water.
    preferredYRange: [0.1, 0.6],

    // Huge body — holds the most text of any fish.
    textSlotCapacity: 20,
    textDisplayDuration: 6,
    textFadeDuration: 2,

    normalSwimSpeed: 70,
    fastSwimSpeed: 140,

    spriteKey: "fish_whale_shark",
  },

  {
    id: "oarfish",
    displayName: "Oarfish",
    fishType: FISH_TYPE.SOLITARY,

    // Oarfish are extremely rare — a sighting is a special moment.
    spawnWeight: 2,

    schoolSizeMin: null,
    schoolSizeMax: null,

    // Oarfish are deep-water creatures.
    preferredYRange: [0.7, 0.98],

    textSlotCapacity: 15,
    textDisplayDuration: 5,
    textFadeDuration: 2,

    // Oarfish move very slowly and gracefully.
    normalSwimSpeed: 30,
    fastSwimSpeed: 80,

    spriteKey: "fish_oarfish",
  },
];

// ---------------------------------------------------------------------------
// SCENE BOUNDARY DEFAULTS
// These are the fallback values used if UnderwaterScene doesn't override them.
// In practice, UnderwaterScene should pass in values based on actual screen size.
// ---------------------------------------------------------------------------

export const DEFAULT_SCENE_BOUNDS = {
  leftEdgeX:  0,
  rightEdgeX: 1280,
  surfaceY:   50,    // A little below the very top — leaves room for UI
  seaFloorY:  670,   // A little above the very bottom — leaves room for the floor sprite
};

// ---------------------------------------------------------------------------
// SPAWNER SETTINGS
// Global tuning values for the FishSpawner.
// ---------------------------------------------------------------------------

export const SPAWNER_SETTINGS = {
  // How many individual fish (counting school members) should be on screen
  // at any one time. The spawner will keep filling until this is reached.
  targetPopulation: 30,

  // When a fish or school despawns, the replacement is spawned this many
  // pixels outside the opposite edge, so it appears to swim in naturally.
  spawnOffscreenMargin: 100,

  // The Y repulsion zone near the surface and floor.
  // Fish will start steering away when they get this close to the boundary.
  yBoundaryRepulsionDistance: 60, // pixels
};