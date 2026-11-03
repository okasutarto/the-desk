// "The Desk": an orthographic, neo-brutalist diorama of a work corner. Each section of
// the site is a prop: the ID badge on the monitor (hero), a pinned wall board (about), a stack of
// boarding passes (experience), a pile of case files (projects) and a postcard (contact).
// The phone on its stand is the AI chat.
// Clicking one flies the camera in and plays a little arrival move. Everything is read (and
// written: the postcard, the chat) on the props themselves; nothing hands off to the 2D site.
//
// The 2D site's look carried into 3D:
// - thick black outlines: inverted hulls pushed out along smoothed normals
// - flat toon shading with three hard bands
// - window light and shadows on the actual toon-shaded surfaces
import { installSceneShaders } from "./sceneShaders";
import { benchmark, lowPower } from "./sceneConfig";
import { createCore } from "./scene/core";
import { createTextInput } from "./scene/textInput";
import { createRoom } from "./scene/room";
import { createWindowBlind } from "./scene/windowBlind";
import { createWeather } from "./scene/weather";
import { createGuitar } from "./scene/guitar";
import { createWindowLighting } from "./scene/windowLighting";
import { createWallDecor } from "./scene/wallDecor";
import { createChair } from "./scene/chair";
import { createLamp } from "./scene/lamp";
import { createPlant } from "./scene/plant";
import { createShelf } from "./scene/shelf";
import { createSecrets } from "./scene/secrets";
import { createShelfConsole } from "./scene/shelfConsole";
import { createShelfBooks } from "./scene/shelfBooks";
import { createRobot } from "./scene/robot";
import { createShelfCollectibles } from "./scene/shelfCollectibles";
import { createStrawHat } from "./scene/strawHat";
import { createSwordRack } from "./scene/swordRack";
import { createSwordEffects } from "./scene/swordEffects";
import { createSwords } from "./scene/swords";
import { createHandheld } from "./scene/handheld";
import { createGauntlet } from "./scene/gauntlet";
import { createGym } from "./scene/gym";
import { createWastebasket } from "./scene/wastebasket";
import { createCatTree } from "./scene/catTree";
import { createWorkstation } from "./scene/workstation";
import { createTimesGate } from "./scene/timesGate";
import { createBadge } from "./scene/badge";
import { createAboutBoard } from "./scene/aboutBoard";
import { createKeyboard } from "./scene/keyboard";
import { createMouse } from "./scene/mouse";
import { createTickets } from "./scene/tickets";
import { createCat } from "./scene/cat";
import { createChat } from "./scene/chat";
import { createProjectFiles } from "./scene/projectFiles";
import { createPostcard } from "./scene/postcard";
import { createCoffee } from "./scene/coffee";
import { createTheme } from "./scene/theme";
import { createPointer } from "./scene/pointer";
import { createTouch } from "./scene/touch";
import { createCamera } from "./scene/camera";
import { createAnimation } from "./scene/animation";
import { createLifecycle } from "./scene/lifecycle";

export { SECTIONS } from "./sceneConfig";

installSceneShaders(benchmark, lowPower);

export function createDeskScene({ container, projects, experiences, dark = false, muted = false, wallColor = "#3a3a3a", wallPattern = {}, woods = {}, floor = {}, time = "auto", rain = "auto", timesGateFinish = "silver", onEvent = () => {} }) {
  // Each scene owns its state. Factories run in construction order; callbacks can access
  // parts created later, and mutable exports remain live through their module accessors.
  const runtime = { options: { container, projects, experiences, dark, muted, wallColor, wallPattern, woods, floor, time, rain, timesGateFinish, onEvent } };
  runtime.core = createCore(runtime);
  runtime.textInput = createTextInput(runtime);
  runtime.room = createRoom(runtime);
  runtime.windowBlind = createWindowBlind(runtime);
  runtime.weather = createWeather(runtime);
  runtime.guitar = createGuitar(runtime);
  runtime.windowLighting = createWindowLighting(runtime);
  runtime.wallDecor = createWallDecor(runtime);
  runtime.chair = createChair(runtime);
  runtime.lamp = createLamp(runtime);
  runtime.plant = createPlant(runtime);
  runtime.shelf = createShelf(runtime);
  runtime.secrets = createSecrets(runtime);
  runtime.shelfConsole = createShelfConsole(runtime);
  runtime.shelfBooks = createShelfBooks(runtime);
  runtime.robot = createRobot(runtime);
  runtime.shelfCollectibles = createShelfCollectibles(runtime);
  runtime.strawHat = createStrawHat(runtime);
  runtime.swordRack = createSwordRack(runtime);
  runtime.swordEffects = createSwordEffects(runtime);
  runtime.swords = createSwords(runtime);
  runtime.handheld = createHandheld(runtime);
  runtime.gauntlet = createGauntlet(runtime);
  runtime.gym = createGym(runtime);
  runtime.wastebasket = createWastebasket(runtime);
  runtime.workstation = createWorkstation(runtime);
  runtime.timesGate = createTimesGate(runtime);
  runtime.badge = createBadge(runtime);
  runtime.aboutBoard = createAboutBoard(runtime);
  runtime.catTree = createCatTree(runtime);
  runtime.keyboard = createKeyboard(runtime);
  runtime.mouse = createMouse(runtime);
  runtime.tickets = createTickets(runtime);
  runtime.cat = createCat(runtime);
  runtime.chat = createChat(runtime);
  runtime.projectFiles = createProjectFiles(runtime);
  runtime.postcard = createPostcard(runtime);
  runtime.coffee = createCoffee(runtime);
  runtime.theme = createTheme(runtime);
  runtime.pointer = createPointer(runtime);
  runtime.touch = createTouch(runtime);
  runtime.camera = createCamera(runtime);
  runtime.animation = createAnimation(runtime);
  runtime.animation.start();
  // Bake spike (spike/bake/README.md): `?bake` in development hands the room to bakeSpike.js
  if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).has("bake")) {
    import("./bakeSpike").then(({ startBakeSpike }) => startBakeSpike(runtime));
  }
  return createLifecycle(runtime);
}
