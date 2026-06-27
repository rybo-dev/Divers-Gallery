import { Assets, Container, Sprite } from "pixi.js";
import { Character } from "../objects/character";
import { Camera } from "../objects/camera";
import { Bounds } from "../objects/fish_system/boundaries";
import { FishSpawner } from "../objects/fish_system/fish_spawner";
import { TextDistributor } from "../objects/fish_system/text_distributor";
import { CameraCapture } from "../objects/camera_capture/camera_capture";
import { getPlayer } from "../objects/player.js";
import * as Menu from "./menu.js";

let initPopulation = 20;
let isPlaying = false;
let isVideoReady = false;

export async function loadLevel(pixiApp, switchTo) {

    const container = new Container();
    const fishLayer = new Container(); // separate container for the fishes

    pixiApp.stage.addChild(container);

    // assets loading
    await Assets.loadBundle("sea_scene");
    await Assets.loadBundle("fishes");

    // sprites
    const bg = new Sprite(Assets.get("sea_bg"));
    const loadedTextures = {
        fish1: Assets.get("fish1"),
        fish2: Assets.get("fish2")
    };

    container.addChild(bg);
    container.addChild(fishLayer);

    // miku
    const mikuImg = Assets.get("miku");

    const miku = new Character({
        speed: 10, scale: 0.3, texture: mikuImg
    });
    miku.sprite.x = 400;
    miku.sprite.y = 400;

    container.addChild(miku.sprite);

    // camera that follows miku
    const camera = new Camera(container, 
        {
            lerpFactor: 0.08,
            viewWidth:  pixiApp.screen.width,
            viewHeight: pixiApp.screen.height,
            bounds: {
                x:      bg.x,
                y:      bg.y,
                width:  bg.width,
                height: bg.height,
            },
        });

    // camera snapping for taking pictures of the fishes
    const cameraCapture = new CameraCapture(pixiApp);
    await cameraCapture.initialize();

    // scene bounds
    const sceneBounds = new Bounds(
        bg.x,               //left edge
        bg.x + bg.width,    // right edge
        80,                     //surface
        bg.y + bg.height - 60   // sea floor
    );

    // viewport
    const getViewport = () => ({
        left:   -container.x,
        right:  -container.x + pixiApp.screen.width,
        top:    -container.y,
        bottom: -container.y + pixiApp.screen.height,
    });

    // fish lyric system that distributes the lyrics to the on screen fishes
    const fishSpawner     = new FishSpawner(fishLayer, sceneBounds, loadedTextures);
    const textDistributor = new TextDistributor(fishSpawner, getViewport);

    // Prime the population so the scene isn't empty on the first frame.
    while (fishSpawner.activeFishList.length < initPopulation) {
        const speciesConfig = fishSpawner.rollWeightedSpecies();
        fishSpawner.spawnSolitaryFish(speciesConfig);
    }

    // *********TEXTALIVE PLAYER***********
    const animateChar = function (now, unit) {
        if (unit.contains(now)) {

            if (!unit.spawned) { // lyrics appear one by onw
                unit.spawned = true;
                textDistributor.receiveCharacter(unit.text);
            }
        } else {
            unit.spawned = false;
        }
    }


    const player = getPlayer();
    const playerListener = ({
        onAppReady(app){
            if (!app.managed){
                const pause = window.addEventListener("keyup", (event)=> {
                    if (!isVideoReady) return;

                    if (event.code === "KeyP"){
                        if (isPlaying){
                            player.video && player.requestPause();
                            isPlaying = false;
                        } else {
                            player.video && player.requestPlay();
                            isPlaying = true;
                        }
                    }
                })
            }

            if (!app.songUrl){
                // アフター・ザ・カーテン / Rulmry
                player.createFromSongUrl("https://piapro.jp/t/zoqO/20251214200738", {
                  video: {
                    // 音楽地図訂正履歴
                    beatId: 4827294,
                    chordId: 2963755,
                    repetitiveSegmentId: 3086262,
                
                    // 歌詞URL: https://piapro.jp/t/EVO2
                    // 歌詞タイミング訂正履歴: https://textalive.jp/lyrics/piapro.jp%2Ft%2FzoqO%2F20251214200738
                    lyricId: 126591,
                    lyricDiffId: 28627
                  },
                });
            } else {
                console.log("URL did not load");
            }
        },

        onVideoReady(video) {
            isVideoReady = true;
        },

        onTimerReady(){
            let w = player.video.firstChar;

            while(w && w.next){
                w.animate = animateChar;
                w = w.next;
            }
        }
    })

    player.addListener(playerListener);


    // const space = (event) => {
    //      if (event.code === "Space") {
    //         textDistributor.receiveCharacter("Q");
    //     }
    // }

    const esc = (event) => {
        if (event.code === "Escape"){
            switchTo(Menu);
        }
    }

    // test for text distribution
    window.addEventListener("keyup", esc);

    // test for scene switching
    // window.addEventListener("keyup", space)

    // updates/ticker
    const onTick = (ticker) => {
        const deltaTimeInSeconds = ticker.deltaTime / 60;

        miku.update(container)
        camera.update(miku.sprite.x, miku.sprite.y);
        fishSpawner.update(deltaTimeInSeconds);
        textDistributor.update(deltaTimeInSeconds);
    };

    pixiApp.ticker.add(onTick);

    return {
        container,
        update(delta) {},
        destroy() {
            pixiApp.ticker.remove(onTick);
            container.destroy({ children: true });
            miku.destroy();
            cameraCapture.destroy();
            window.removeEventListener("keyup", esc);
            // window.removeEventListener("keyup", space);
            // player.removeListener(playerListener);
        }
    };
}