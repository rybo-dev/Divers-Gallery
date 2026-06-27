import { Application, Assets } from 'pixi.js';
import { init, switchTo } from "./sceneManager.js";
import * as DivingScene from "./scenes/diving_scene.js";
import * as Menu from "./scenes/menu.js";

(async() => {
    // initializing the application
    const app = new Application();

    await app.init({
        resizeTo: window,
    });

    app.canvas.style.position = 'absolute';

    document.body.appendChild(app.canvas);

    await Assets.init({manifest: `${import.meta.env.BASE_URL}assets/manifest.json` });

    init(app);

    switchTo(Menu);
})();