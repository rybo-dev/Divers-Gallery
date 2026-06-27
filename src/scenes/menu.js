import { GlowFilter } from "pixi-filters";
import { Assets, Container, Sprite, Polygon, Graphics } from "pixi.js";
import { CaptureGallery } from "../objects/camera_capture/capture_gallery";
import { getCaptures } from "../objects/camera_capture/capture_store.js";
import * as DivingScene from "./diving_scene.js";

let isAlbumVisible = false;

// DEBUG - set images slots in album (delete later)
function debugDrawSlots(container, slotPositions, slotWidth, slotHeight) {

    for (let i = 0; i < slotPositions.length; i++) {

        const position = slotPositions[i];
        const graphics = new Graphics();

        // Draw a filled rectangle with a colored outline.
        // The fill is semi-transparent so you can see what's behind it.
        graphics
            .rect(
                -slotWidth  / 2,   // offset by half since slots are anchor 0.5
                -slotHeight / 2,
                slotWidth,
                slotHeight
            )
            .fill({ color: 0x0000ff, alpha: 0.2 })      // semi-transparent blue fill
            .stroke({ color: 0xff0000, width: 2 });      // solid red border

        graphics.x = position.x;
        graphics.y = position.y;

        // Label each slot with its index so you know which is which.
        // Uses a plain PixiJS Text for the number.
        container.addChild(graphics);
    }
}
// DELETE LATER


const albumClickHitArea = [
        250, 110,
        250, 50,
        60, -110,
        -230, -110,
        -230, -60,
        -50, 110
    ]

const glow = new GlowFilter({
    color: 0xFAE9B1,
    distance: 20,
    outerStrength: 3,
    innerStrength: 0,
    quality: 0.5
});

export async function loadLevel(pixiApp, switchTo) {

    //container
    const container = new Container();
    pixiApp.stage.addChild(container);

    // Assets
    await Assets.loadBundle("menu");

    // background sprite
    const bg = new Sprite(Assets.get("menu_bg"));
    container.addChild(bg);

    // clickable album displayed on the table
    const albumClick = new Sprite(Assets.get("album_click"));
    albumClick.position.set(1119, 526);
    albumClick.anchor.set(0.5);
    albumClick.eventMode = "static";
    albumClick.hitArea = new Polygon(albumClickHitArea);
    albumClick.on("pointerover", () => {
        albumClick.scale.set(1.1);
    })

    albumClick.on("pointerout", () => {
        albumClick.scale.set(1);
    })

    albumClick.on("pointerdown", () => {
        albumClick.filters = [glow];
    })

    albumClick.on("pointerup", () => {
        albumClick.filters = null;
        isAlbumVisible = true;

        overlay.visible = isAlbumVisible;
        album.visible = isAlbumVisible;
        albumRightButton.visible = isAlbumVisible;
        albumLeftButton.visible = isAlbumVisible;
        gallery.setVisible(isAlbumVisible);
    })

    // Debug graphics DELETE LATER
    // const debug = new Graphics()
    //     .poly(albumClickHitArea)
    //     .stroke({
    //         width: 2,
    //         color: 0xff0000
    //     });

    // albumClick.addChild(debug);

    container.addChild(albumClick);

    // level 1 selection
    const level1Container = new Container();
    const level1Select = new Sprite(Assets.get("select_level_1"));
    level1Select.anchor.set(0.5);

    level1Container.position.set(398, 215);
    level1Container.eventMode = "static";
    level1Container.cursor = "pointer";

    level1Container.on("pointerdown", () => {
        level1Container.scale.set(0.97);
    })

    level1Container.on("pointerup", () => {
        level1Container.scale.set(1);
        switchTo(DivingScene);
    })

    container.addChild(level1Container);
    level1Container.addChild(level1Select);

    // level 2 selection
    const level2Container = new Container();
    const level2Select = new Sprite(Assets.get("select_level_2"));
    level2Select.anchor.set(0.5);

    level2Container.position.set(398, 347);
    level2Container.eventMode = "static";
    level2Container.cursor = "pointer";

    level2Container.on("pointerdown", () => {
        level2Container.scale.set(0.97);
    })

    level2Container.on("pointerup", () => {
        level2Container.scale.set(1);
    })

    container.addChild(level2Container);
    level2Container.addChild(level2Select);

    
    // ALBUM AND PICTURES


    // dark overlay to dim the background when viewing album
    const overlay = new Graphics()
        .rect(0, 0, container.width, container.height)
        .fill({ color: 0x000000, alpha: 0.6 });

    overlay.visible = isAlbumVisible;
    overlay.eventMode = 'static';

    container.addChild(overlay);

    // album sprite
    // the album displays the photos taken during the diving gameplay
    const album = new Sprite(Assets.get("album"));
    album.visible = isAlbumVisible;
    container.addChild(album);

    // album buttons
    const albumRightButton = new Sprite(Assets.get("album_right_arrow"));
    albumRightButton.eventMode = "static";
    albumRightButton.cursor = "pointer";
    albumRightButton.visible = isAlbumVisible;
    albumRightButton.position.set(1170, 310);
    container.addChild(albumRightButton);

    const albumLeftButton = new Sprite(Assets.get("album_left_arrow"));
    albumLeftButton.eventMode = "static";
    albumLeftButton.cursor = "pointer";
    albumLeftButton.visible = isAlbumVisible;
    albumLeftButton.position.set(114, 287);
    container.addChild(albumLeftButton);

    // DELETE LATER
    // debugDrawSlots(container, [
    //     { x: 460, y: 250 },
    //     { x: 930, y: 250 },
    //     { x: 460, y: 500 },
    //     { x: 930, y: 500 },
    // ], 320, 180);


    // view the scene from the middle
    container.pivot.set(container.width / 2, container.height / 2);
    container.x = pixiApp.screen.width / 2;
    container.y = pixiApp.screen.height / 2;

    const gallery = new CaptureGallery({
        app:           pixiApp,
        parent:        container, // whatever container holds your menu panel
        slotPositions: [                     // 4 points in the panel's local space
            { x: 460, y: 250 },
            { x: 930, y: 250 },
            { x: 460, y: 500 },
            { x: 930, y: 500 },
        ],
        prevButton:  albumLeftButton,
        nextButton:  albumRightButton,
        slotWidth:   320,   // adjust to fit your layout
        slotHeight:  180,
    });

    await gallery.initialize();
    gallery.setVisible(isAlbumVisible);

    //  go back to main menu if in album viewing mode
    const esc = (event) => {
        if (!isAlbumVisible) return;

        if (event.code === "Escape"){
            isAlbumVisible = false

            overlay.visible = isAlbumVisible;
            album.visible = isAlbumVisible;
            albumRightButton.visible = isAlbumVisible;
            albumLeftButton.visible = isAlbumVisible;
            gallery.setVisible(isAlbumVisible);
        }
    }

    window.addEventListener("keyup", esc);

    return {
        container,
        update(delta) {},
        destroy() {
            container.destroy({ children: true });
            window.removeEventListener("keyup", esc);
            gallery.destroy();
        }
    };
}