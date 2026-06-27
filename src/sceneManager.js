
let _app, _current;

// initializing the Application
export function init(app){
    _app = app;

    app.ticker.add((delta) => _current?.update(delta));
}

// Scene switching function
export async function switchTo(newScene) {
    if (_current){// destroys the current scene
        _app.stage.removeChild(_current.container);
        _current.destroy();
    }

    // loads new scene and set it as new current scene
    _current = await newScene.loadLevel(_app, switchTo);

    // _app.stage.addChild(_current.container);
}