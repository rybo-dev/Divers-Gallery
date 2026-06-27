import { Sprite } from "pixi.js";
import { SchoolFish } from "./school_fish.js";

export class Fish2 extends SchoolFish {
    constructor(speciesConfig, sceneBounds, loadedTextures) {
        super(speciesConfig, sceneBounds);

        const fish2Texture = loadedTextures[speciesConfig.spriteKey];

        this.sprite = new Sprite(fish2Texture);
        this.sprite.anchor.set(0.5);
        this.sprite.scale.set(speciesConfig.spriteScale);

        this.container.addChild(this.sprite);
        this.container.addChild(this.textLabel);
    }
}