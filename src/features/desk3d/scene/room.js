import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvasTexture, drawWindowView, windowSky, drawWallPaint, drawWoodTop, drawWoodFloor } from "../textures";
import { DEFAULT_WOODS, DEFAULT_FLOOR } from "../woods";
import { partFor } from "../daylight";
import { PALETTES } from "../sceneConfig";

export function createRoom(runtime) {
  // ---------- the desk ----------
  // 1 scene unit = 10 cm: a 180 × 84 cm top, 74 cm above the floor.
  const FLOOR_Y = -7.4;
  // The back wall stands flush against the desk: its face meets the monitor riser's back edge
  // (z -4.3), a centimetre behind the top's. What hangs on it is lifted by as much as the move
  // brings it down on screen, so the overview keeps its composition.
  const WALL_Z = -4.43; // the middle of the wall slab; its face is at WALL_Z + 0.12
  const WALL_LIFT = 2.8;
  // The left wall stands just as close to the desk's left end
  const SIDE_X = -9.6; // the middle of the side wall slab; its face is at SIDE_X + 0.12
  // A wood-grain top; the material's colour tints it for the night shift
  const deskMat = runtime.core.toon(PALETTES.light.desk);
  const deskWood = canvasTexture(1800, 840);
  runtime.core.track(deskWood.texture);
  drawWoodTop(deskWood.ctx, 1800, 840, DEFAULT_WOODS.desk);
  deskMat.map = deskWood.texture;
  // A 160 cm top, its left end against the side wall and its right trimmed back to the props
  const DESK_W = 16;
  const DESK_X = -1;
  const desk = runtime.core.mesh(runtime.core.rbox(DESK_W, 0.35, 8.4, 0.1), deskMat, { outline: 0.035 });
  desk.position.set(DESK_X, -0.175, 0);
  runtime.core.scene.add(desk);
  // A sit-stand frame in matte black: two telescoping columns (three stages, widest at the
  // floor) on flat T-feet, a crossbar between them and a rail under the top at each end, with
  // the memory keypad tucked under the front edge on the right
  const legMat = runtime.core.toon("#1a1a1a");
  const frameBar = (w, h, d, x, y, z, outline = 0.045) => {
    const part = runtime.core.mesh(runtime.core.rbox(w, h, d, 0.04), legMat, { outline });
    part.position.set(x, y, z);
    runtime.core.scene.add(part);
    return part;
  };
  [DESK_X - 6.3, DESK_X + 6.3].forEach((x) => {
    frameBar(0.62, 0.22, 7.6, x, FLOOR_Y + 0.13, 0.2, 0.05);
    [-3.35, 3.75].forEach((z) => frameBar(0.4, 0.08, 0.4, x, FLOOR_Y + 0.04, z, 0.03));
    frameBar(0.78, 2.8, 0.62, x, FLOOR_Y + 1.64, 0.2, 0.05);
    frameBar(0.7, 2.5, 0.54, x, -3.35, 0.2);
    frameBar(0.62, 2.0, 0.46, x, -1.4, 0.2);
    frameBar(0.72, 0.1, 7.2, x, -0.4, 0.2, 0.035);
  });
  frameBar(12.6, 0.32, 0.4, DESK_X, -0.61, 0.2);
  const keypad = runtime.core.mesh(runtime.core.rbox(1.25, 0.46, 0.2, 0.06), legMat, { outline: 0.03 });
  keypad.position.set(DESK_X + 5.3, -0.55, 3.98);
  keypad.rotation.x = -0.35;
  const keypadFace = runtime.core.printed(1.15, 0.4, 300, (c, w, h) => {
    c.fillStyle = "#121212";
    c.fillRect(0, 0, w, h);
    c.fillStyle = "#8fd694";
    c.font = "700 30px 'Space Grotesk', sans-serif";
    c.textBaseline = "middle";
    c.fillText("74", 22, h / 2);
    ["^", "1", "3", "M", "v", "2", "4", "◐"].forEach((label, i) => {
      const bx = w * 0.33 + (i % 4) * w * 0.165;
      const by = h * (i < 4 ? 0.3 : 0.72);
      c.fillStyle = "#2a2a2a";
      c.beginPath();
      c.arc(bx, by, 17, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#d8d8d8";
      c.font = "600 18px 'Space Grotesk', sans-serif";
      c.textAlign = "center";
      c.fillText(label, bx, by + 1);
      c.textAlign = "left";
    });
  });
  keypadFace.position.z = 0.102;
  keypad.add(keypadFace);
  runtime.core.scene.add(keypad);

  // ---------- full-viewport room: walls and floor extend beyond every camera shot ----------
  const room = new THREE.Group();
  runtime.core.scene.add(room);
  // Wood flooring: one tile of boards repeated across the floor (8 × 8 units a tile)
  const floorMat = runtime.core.toon("#ffffff");
  const floorWood = canvasTexture(1024, 1024);
  runtime.core.track(floorWood.texture);
  drawWoodFloor(floorWood.ctx, 1024, 1024, DEFAULT_FLOOR);
  floorWood.texture.wrapS = floorWood.texture.wrapT = THREE.RepeatWrapping;
  floorWood.texture.repeat.set(25, 25);
  floorMat.map = floorWood.texture;
  // Both walls share one painted texture in the visitor's pattern, tiled every 4 units (the back
  // wall's box maps 0–1 over its 200 × 100; the side wall's extrusion maps in world units)
  const wallPaint = canvasTexture(512, 512);
  runtime.core.track(wallPaint.texture);
  drawWallPaint(wallPaint.ctx, 512, 512, runtime.options.wallPattern?.pattern, runtime.options.wallPattern);
  wallPaint.texture.wrapS = wallPaint.texture.wrapT = THREE.RepeatWrapping;
  const WALL_TILE = 4;
  const backWallPaint = wallPaint.texture;
  backWallPaint.repeat.set(200 / WALL_TILE, 100 / WALL_TILE);
  const sideWallPaint = runtime.core.track(wallPaint.texture.clone());
  sideWallPaint.needsUpdate = true;
  sideWallPaint.repeat.set(1 / WALL_TILE, 1 / WALL_TILE);
  const backWallMat = runtime.core.toon("#ffffff");
  backWallMat.map = backWallPaint;
  const sideWallMat = runtime.core.toon("#ffffff");
  // Matte paint needs a continuous response: the props' three toon bands turn overlapping
  // strip lights into visible circular patches on these otherwise flat walls.
  const wallGradient = runtime.core.track(new THREE.DataTexture(Uint8Array.from({ length: 256 }, (_, i) => Math.round(70 + i * 185 / 255)), 256, 1, THREE.RedFormat));
  wallGradient.minFilter = wallGradient.magFilter = THREE.LinearFilter;
  wallGradient.needsUpdate = true;
  backWallMat.gradientMap = sideWallMat.gradientMap = wallGradient;
  sideWallMat.map = sideWallPaint;
  const trimMat = runtime.core.toon("#ffffff");
  const roomBox = (w, h, d, material, x, y, z, outline = 0.055) => {
    const part = runtime.core.mesh(new THREE.BoxGeometry(w, h, d), material, { outline, cast: false });
    part.position.set(x, y, z);
    room.add(part);
    return part;
  };
  // The floor, back wall and skirting stop at the side wall's outside face: nothing of the room
  // runs on outside it, where the window looks out (the view out there is a painted backdrop)
  const OUT_X = SIDE_X - 0.12 + 100;
  const fullRoom = [
    roomBox(200, 0.25, 200, floorMat, OUT_X, FLOOR_Y - 0.17, 1.2),
    // (no outline: it's only ever seen edge-on, from the window's close-up, as a black line
    // down the corner)
    roomBox(200, 100, 0.24, backWallMat, OUT_X, FLOOR_Y + 50, WALL_Z, 0),
  ];
  // The wall materials already receive the real light's shadows. A separate ShadowMaterial
  // mask would darken them even outside the window cookie or an indoor light's actual reach.
  // The side wall, with a real opening cut for the window (see the window below). Built as
  // its outline extruded through the wall's thickness, the opening as a hole in it.
  // World dimensions: a 120 × 105 cm two-leaf European casement, its sill (110 cm off the
  // floor) just clear above the project folders' tabs on the desk, even with one lifted on hover.
  const WINDOW_AT = { y: 8.8, z: 3.05, w: 12.0, h: 10.5 }; // its back edge 14 cm off the back wall
  // Half the glass, in the window group's own units (it's built at half size and scaled ×2),
  // inside the frame's 4 cm border: the frame, bars, view, blind and the light through it
  // all follow from this
  const GLASS = { x: WINDOW_AT.w / 4 - 0.2, y: WINDOW_AT.h / 4 - 0.2 };
  // A 6 cm post of the main frame splits the opening in two; a leaf fills each side, in its
  // own 6 cm sash frame (a little deeper at the foot), split into four panes by a slimmer 2 cm
  // cross of glazing bars. `LEAVES` holds each sash's outline and the glass inside it, `PANES` the eight panes,
  // all as [x0, x1, y0, y1], left leaf first, each column bottom pane then top.
  const MULLION = 0.15; // half the frame's middle post
  const SASH = 0.3;
  const SASH_FOOT = 0.36;
  const BAR = 0.05; // half a glazing bar
  const LEAVES = [[-GLASS.x, -MULLION], [MULLION, GLASS.x]].map(([x0, x1]) => ({
    outer: [x0, x1, -GLASS.y, GLASS.y],
    inner: [x0 + SASH, x1 - SASH, -GLASS.y + SASH_FOOT, GLASS.y - SASH],
  }));
  const PANES = LEAVES.flatMap(({ inner: [x0, x1, y0, y1] }) => {
    const [mx, my] = [(x0 + x1) / 2, (y0 + y1) / 2];
    return [[x0, mx - BAR], [mx + BAR, x1]].flatMap(([a, b]) => [[a, b, y0, my - BAR], [a, b, my + BAR, y1]]);
  });
  const wallShape = new THREE.Shape();
  // Shape x runs along -z once stood up; y is height
  wallShape.moveTo(-101.2, FLOOR_Y);
  wallShape.lineTo(98.8, FLOOR_Y);
  wallShape.lineTo(98.8, FLOOR_Y + 100);
  wallShape.lineTo(-101.2, FLOOR_Y + 100);
  wallShape.closePath();
  const opening = new THREE.Path();
  const ox = -WINDOW_AT.z;
  const halfW = WINDOW_AT.w / 2 + 0.01;
  const halfH = WINDOW_AT.h / 2 + 0.01;
  opening.moveTo(ox - halfW, WINDOW_AT.y - halfH);
  opening.lineTo(ox - halfW, WINDOW_AT.y + halfH);
  opening.lineTo(ox + halfW, WINDOW_AT.y + halfH);
  opening.lineTo(ox + halfW, WINDOW_AT.y - halfH);
  opening.closePath();
  wallShape.holes.push(opening);
  const sideWallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: 0.24, bevelEnabled: false });
  sideWallGeo.rotateY(Math.PI / 2);
  const sideWall = runtime.core.mesh(sideWallGeo, sideWallMat, { outline: 0.055, cast: false });
  sideWall.position.x = SIDE_X - 0.12;
  room.add(sideWall);
  fullRoom.push(
    sideWall,
    roomBox(200, 0.22, 0.16, trimMat, OUT_X, FLOOR_Y + 0.17, WALL_Z + 0.23, 0.025),
    roomBox(0.16, 0.22, 200, trimMat, SIDE_X + 0.23, FLOOR_Y + 0.17, 1.2, 0.025),
  );

  // On a portrait screen the room is a diorama instead: the same two walls and floor cut off
  // just past the furniture, standing on a thick slab, the whole of it framed on the page's
  // own background (see SHOTS.overview), with a pinch to look closer
  const DIORAMA = { x0: SIDE_X - 0.12, x1: 24.5, z0: WALL_Z - 0.12, z1: 15.0, top: 23.0, slab: 0.9 };
  const slabMat = runtime.core.toon("#3a332c");
  // A box whose faces tile their texture as the endless room's do (one unit is one unit)
  const dioramaBox = (w, h, d, material, x, y, z, uvScale, outline = 0.055) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale[0], uv.getY(i) * uvScale[1]);
    const part = runtime.core.mesh(geo, material, { outline, cast: false });
    part.position.set(x, y, z);
    room.add(part);
    return part;
  };
  const dioramaW = DIORAMA.x1 - DIORAMA.x0;
  const dioramaD = DIORAMA.z1 - DIORAMA.z0;
  const dioramaMidX = (DIORAMA.x0 + DIORAMA.x1) / 2;
  const dioramaMidZ = (DIORAMA.z0 + DIORAMA.z1) / 2;
  const floorTop = FLOOR_Y - 0.045;
  const dioramaWallH = DIORAMA.top - FLOOR_Y;
  // The floor's planks on top, the slab's raw edge on every other face
  const slabFaces = [slabMat, slabMat, floorMat, slabMat, slabMat, slabMat];
  const dioramaSideShape = new THREE.Shape();
  dioramaSideShape.moveTo(-DIORAMA.z1, FLOOR_Y);
  dioramaSideShape.lineTo(-DIORAMA.z0, FLOOR_Y);
  dioramaSideShape.lineTo(-DIORAMA.z0, DIORAMA.top);
  dioramaSideShape.lineTo(-DIORAMA.z1, DIORAMA.top);
  dioramaSideShape.closePath();
  dioramaSideShape.holes.push(opening);
  const dioramaSideGeo = new THREE.ExtrudeGeometry(dioramaSideShape, { depth: 0.24, bevelEnabled: false });
  dioramaSideGeo.rotateY(Math.PI / 2);
  const dioramaSide = runtime.core.mesh(dioramaSideGeo, sideWallMat, { outline: 0.055, cast: false });
  dioramaSide.position.x = SIDE_X - 0.12;
  room.add(dioramaSide);
  const dioramaRoom = [
    dioramaBox(dioramaW, DIORAMA.slab, dioramaD, slabFaces, dioramaMidX, floorTop - DIORAMA.slab / 2, dioramaMidZ, [dioramaW / 200, dioramaD / 200], 0.07),
    dioramaBox(dioramaW, dioramaWallH, 0.24, backWallMat, dioramaMidX, FLOOR_Y + dioramaWallH / 2, WALL_Z, [dioramaW / 200, dioramaWallH / 100], 0.07),
    dioramaSide,
    roomBox(dioramaW, 0.22, 0.16, trimMat, dioramaMidX, FLOOR_Y + 0.17, WALL_Z + 0.23, 0.025),
    roomBox(0.16, 0.22, dioramaD, trimMat, SIDE_X + 0.23, FLOOR_Y + 0.17, dioramaMidZ, 0.025),
  ];
  let diorama = false;
  const roomBackground = (isDark) => (diorama ? (isDark ? "#2a2440" : "#ffffff") : isDark ? "#d6d3e6" : "#ffffff");
  function setDiorama(on) {
    diorama = on;
    fullRoom.forEach((part) => (part.visible = !on));
    dioramaRoom.forEach((part) => (part.visible = on));
    runtime.core.scene.background.set(roomBackground(runtime.theme.darkNow));
    // The day/night blend holds the background too: it's told the new one
    const at = runtime.theme.lightingColors.indexOf(runtime.core.scene.background);
    [runtime.theme.lightingFrom, runtime.theme.lightingTarget].forEach((state) => state.colors[at].copy(runtime.core.scene.background));
    if (on) drawBackdrop();
  }

  // Behind the diorama, a clean white page with the 2D site's dot grid. A screen-sized card that follows the camera (see the loop), redrawn for size and theme
  const backdropTex = canvasTexture(4, 4);
  runtime.core.track(backdropTex.texture);
  const backdrop = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(1, 1)), runtime.core.track(new THREE.MeshBasicMaterial({ map: backdropTex.texture, depthWrite: false, toneMapped: false })));
  backdrop.raycast = runtime.core.noRaycast;
  backdrop.renderOrder = -2;
  runtime.core.scene.add(backdrop);
  function drawBackdrop() {
    const scale = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.round((runtime.options.container.clientWidth || 1) * scale);
    const h = Math.round((runtime.options.container.clientHeight || 1) * scale);
    const { canvas, ctx: c } = backdropTex;
    if (canvas.width !== w || canvas.height !== h) {
      Object.assign(canvas, { width: w, height: h });
      backdropTex.texture.dispose();
    }
    const night = runtime.theme.darkNow;
    const ink = night ? "#0d0b14" : "#1a1714";
    dioramaShadow.material.color.set(ink);
    c.fillStyle = night ? "#2a2440" : "#ffffff";
    c.fillRect(0, 0, w, h);
    // the page's dot grid
    const gap = 22 * scale;
    c.fillStyle = night ? "rgba(255,255,255,.12)" : "rgba(26,23,20,.16)";
    for (let y = gap / 2; y < h; y += gap) {
      for (let x = gap / 2; x < w; x += gap) {
        c.beginPath();
        c.arc(x, y, 1.6 * scale, 0, Math.PI * 2);
        c.fill();
      }
    }
    backdropTex.texture.needsUpdate = true;
  }
  // The diorama's own hard shadow: the block's outline as seen, in solid ink, laid flat just in
  // front of the backdrop and nudged down to the right on screen (see the loop)
  const dioramaShadow = new THREE.Mesh(new THREE.BufferGeometry(), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#1a1714", toneMapped: false, depthWrite: false })));
  dioramaShadow.raycast = runtime.core.noRaycast;
  dioramaShadow.renderOrder = -1;
  runtime.core.scene.add(dioramaShadow);
  let dioramaShadowFor = null;
  // The block's eight corners in the view's right/up coordinates, wrapped in their hull
  function shapeDioramaShadow(right, up) {
    const pts = [];
    const corner = new THREE.Vector3();
    [DIORAMA.x0, DIORAMA.x1].forEach((x) => [floorTop - DIORAMA.slab, DIORAMA.top].forEach((y) => [DIORAMA.z0, DIORAMA.z1].forEach((z) => {
      corner.set(x, y, z);
      pts.push(new THREE.Vector2(corner.dot(right), corner.dot(up)));
    })));
    pts.sort((a, b) => a.x - b.x || a.y - b.y);
    const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
    const half = (list) => list.reduce((hull, p) => {
      while (hull.length >= 2 && cross(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop();
      hull.push(p);
      return hull;
    }, []);
    const lower = half(pts);
    const upper = half([...pts].reverse());
    dioramaShadow.geometry.dispose();
    dioramaShadow.geometry = new THREE.ShapeGeometry(new THREE.Shape([...lower.slice(0, -1), ...upper.slice(0, -1)]));
  }
  dioramaRoom.push(backdrop, dioramaShadow);
  dioramaRoom.forEach((part) => (part.visible = false));

  // Rear LED strips illuminate surfaces through actual shadowed lights.
  const DESK_WASH = 0.45;
  // Every neon also lights the room for real: a point light that follows its glow (fade, flicker,
  // party), so the toon surfaces pick up the colour and the props throw coloured shadows
  const neonLights = [];
  // `tint` follows a material whose colour changes (a console's LED); `shadow` costs a texture
  // unit in every lit shader, so it's kept to the lights whose shadows read (16 is the usual cap)
  const neonLight = (color, max, level, { distance = 8, shadow = false, tint = null } = {}) => {
    const light = new THREE.PointLight(color, 0, distance, 2);
    if (shadow) {
      light.castShadow = true;
      light.shadow.mapSize.set(512, 512);
      light.shadow.camera.near = 0.05;
      light.shadow.bias = -0.002;
      light.shadow.normalBias = 0.03;
      light.shadow.radius = 6;
      // A point light's shadow is six renders of the room; see updateNeonLights
      light.shadow.autoUpdate = false;
      light.shadow.needsUpdate = true;
      shadowedNeons.push(light);
    }
    neonLights.push({ light, max, level, tint });
    return light;
  };
  const shadowedNeons = [];
  let neonShadowTurn = 0;
  let neonShadowAt = 0;
  function updateNeonLights(now, moving = false) {
    neonLights.forEach(({ light, max, level, tint }) => {
      light.intensity = max * level();
      if (tint) light.color.copy(tint.color);
    });
    // Cache decorative shadows while idle; motion gets one cube update per rendered frame.
    if (!shadowedNeons.length || (!moving && now < neonShadowAt)) return;
    neonShadowAt = now + 50;
    neonShadowTurn = (neonShadowTurn + 1) % shadowedNeons.length;
    const light = shadowedNeons[neonShadowTurn];
    if (light.intensity > 0) light.shadow.needsUpdate = true;
  }
  // Shared broad emitters for the desk and monitor strips. A flat inner cone and overlapping
  // coverage keep the individual sample centres from reading as little spotlights.
  const stripLight = (color, level, position, target, parent = runtime.core.scene) => {
    const light = new THREE.SpotLight(color, 0, 4.5, 1.5, 0.12, 0);
    light.position.set(...position);
    light.target.position.set(...target);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.near = 0.05;
    light.shadow.bias = -0.0003;
    light.shadow.normalBias = 0.015;
    light.shadow.radius = 9;
    light.shadow.autoUpdate = false;
    light.shadow.needsUpdate = true;
    shadowedNeons.push(light);
    // ponytail: overlapping samples approximate a strip; true area shadows need a different renderer.
    neonLights.push({ light, max: 1.1, level });
    parent.add(light, light.target);
    return light;
  };
  const deskNeons = ["#00e0c6", "#ff90e8"].map((color, i) => {
    const x = DESK_X + (i === 0 ? -DESK_W / 4 : DESK_W / 4);
    const strip = new THREE.Mesh(
      runtime.core.track(new THREE.BoxGeometry(DESK_W / 2, 0.045, 0.06)),
      runtime.core.track(new THREE.MeshBasicMaterial({ color })),
    );
    // tucked just under the top's back edge, so only its light shows, never the strip itself
    strip.position.set(x, -0.3, -4.23);
    strip.raycast = runtime.core.noRaycast;
    // Fade state only: no painted wall glow that can bypass an occluding prop.
    const washMat = { opacity: 0 };
    // Four broad samples retain the strip coverage and leave texture units for the
    // monitor task light and textured/bump-mapped materials on 16-sampler GPUs.
    const lights = Array.from({ length: 2 }, (_, sample) => {
      const sx = x - DESK_W / 4 + (sample + 0.5) * DESK_W / 4;
      return stripLight(color, () => 1.5 * washMat.opacity / DESK_WASH,
        [sx, strip.position.y, strip.position.z], [sx, 2.5, WALL_Z + 0.12]);
    });
    runtime.core.scene.add(strip);
    return { strip, washMat, lights };
  });

  // A framed illustration on the left wall: four panes, a sun/moon and angular trees.
  const windowGroup = new THREE.Group();
  windowGroup.scale.setScalar(2);
  // Seated in the wall's opening, the frame's face all but flush with the wall's, so the wall
  // runs straight up to the wood: the group's origin is the frame's plane, WINDOW_DEPTH behind
  // the wall's face
  const WINDOW_DEPTH = 0.1;
  windowGroup.position.set(SIDE_X + 0.12 - WINDOW_DEPTH * 2, WINDOW_AT.y, WINDOW_AT.z);
  windowGroup.rotation.y = Math.PI / 2;
  room.add(windowGroup);
  // One wooden frame, matching glazing bars and sill, with a brass catch and faint glare.
  const windowWood = canvasTexture(512, 512);
  runtime.core.track(windowWood.texture);
  drawWoodTop(windowWood.ctx, 512, 512);
  // The frame keeps its own copy of the grain, so a new wood for it leaves the painting, the
  // lamp and the board (which share windowWood) as they are
  const frameGrainTex = canvasTexture(512, 512);
  runtime.core.track(frameGrainTex.texture);
  drawWoodTop(frameGrainTex.ctx, 512, 512, DEFAULT_WOODS.window);
  const frameWood = runtime.core.toon("#f0c7a0");
  frameWood.map = frameGrainTex.texture;
  // Each piece is a rectangle with rectangular holes cut in it (no overlapping faces or outline
  // seams where parts cross), its wood grain mapped across the whole frame.
  const rect = (path, [x0, x1, y0, y1]) => {
    path.moveTo(x0, y0);
    [[x1, y0], [x1, y1], [x0, y1]].forEach(([x, y]) => path.lineTo(x, y));
    return path;
  };
  const cutOut = (outline, holes) => {
    const shape = rect(new THREE.Shape(), outline);
    holes.forEach((hole) => shape.holes.push(rect(new THREE.Path(), hole)));
    return shape;
  };
  const woodPiece = (shapes, depth, z, outline = 0.015) => {
    const geo = mergeGeometries(shapes.map((shape) => new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })));
    const position = geo.attributes.position;
    for (let i = 0; i < position.count; i++) {
      geo.attributes.uv.setXY(i, position.getX(i) / (GLASS.x * 2 + 0.4) + 0.5, position.getY(i) / (GLASS.y * 2 + 0.4) + 0.5);
    }
    const piece = runtime.core.mesh(geo, frameWood, { cast: false, outline });
    piece.position.z = z;
    windowGroup.add(piece);
    return piece;
  };
  // The main frame and its middle post in one piece, all but flush with the wall's face, the
  // opening open behind it on either side of the post
  const windowFrame = woodPiece([cutOut([-GLASS.x - 0.2, GLASS.x + 0.2, -GLASS.y - 0.2, GLASS.y + 0.2], LEAVES.map(({ outer }) => outer))], 0.18, -0.09, 0.03);
  // Keep the animated view at the same cadence in overview and close-up.
  // The room opens on the part of the day the visitor's clock (or their pick) says; night
  // switches on the room's lamps. The page already opened in the dark theme for a night.
  const startRain = runtime.core.previewRain ?? 0;
  const outside = { t: 0, flockAt: -99, starAt: -99, drawnAt: 0, rain: startRain, rainTarget: startRain, clicks: [], night: runtime.options.dark };
  const daylightParts = ["morning", "day", "evening", "night"];
  const startPart = partFor(runtime.options.time);
  let daylightPart = daylightParts.includes(runtime.core.previewTime) ? runtime.core.previewTime : runtime.options.dark ? "night" : startPart === "night" ? "morning" : startPart;
  const dayPart = () => (outside.night ? "night" : daylightPart);
  outside.sky = windowSky(dayPart());
  const windowView = runtime.core.printed(GLASS.x * 2, GLASS.y * 2, 220, (c, w, h) => drawWindowView(c, w, h, { ...outside, time: dayPart() }), { unlit: true });
  windowView.position.z = -0.14; // behind the leaves' glazing bars
  // The view is the far distance: drawn first and writing no depth, so leaves swung out past
  // it still show in front of it through the opening (the wall round it hides the rest)
  windowView.renderOrder = -1;
  windowView.material.depthWrite = false;
  windowGroup.add(windowFrame, windowView);
  // The sill runs out from the frame past the wall's face, with an apron board under it. Its
  // top sits clearly above the opening's floor and the frame's foot (both end inside it), so
  // no two faces share a plane and flicker as the camera moves.
  const sill = runtime.core.mesh(new THREE.BoxGeometry(GLASS.x * 2 + 0.4 + 0.5, 0.2, WINDOW_DEPTH + 0.45), frameWood, { cast: false, outline: 0.03 });
  sill.position.set(0, -(GLASS.y + 0.2) - 0.03, (WINDOW_DEPTH + 0.45) / 2);
  const apron = runtime.core.mesh(runtime.core.rbox(GLASS.x * 2 + 0.1, 0.26, 0.08, 0.03), frameWood, { cast: false, outline: 0.02 });
  apron.position.set(0, -(GLASS.y + 0.2) - 0.29, WINDOW_DEPTH + 0.04);
  windowGroup.add(sill, apron);
  // Each leaf hangs on hinges along its outer edge, at its outside face, and swings out when
  // its handle is turned (see windowLighting); everything on a leaf moves with it
  const leaves = LEAVES.map(({ outer: [x0, x1] }, leaf) => {
    const hinge = new THREE.Group();
    hinge.position.set(leaf ? x1 : x0, 0, -0.16);
    windowGroup.add(hinge);
    return hinge;
  });
  const onLeaf = (leaf, obj) => {
    obj.position.sub(leaves[leaf].position);
    leaves[leaf].add(obj);
    return obj;
  };
  const leafPanes = (leaf) => PANES.slice(leaf * 4, leaf * 4 + 4);
  // The leaves sit back 2.2 cm inside the main frame, their glazing bars a further 4 mm
  LEAVES.forEach(({ outer, inner }, leaf) => {
    onLeaf(leaf, woodPiece([cutOut(outer, [inner])], 0.14, -0.16));
    onLeaf(leaf, woodPiece([cutOut(inner, leafPanes(leaf))], 0.08, -0.12));
  });
  const brass = runtime.core.toon("#d4a72c");
  // A handle low on each leaf's stile by the middle post, mirrored (the left leaf's on its
  // right, the right leaf's on its left): a tall silver backplate and a lever hanging down from its
  // spindle, closed. Each lever turns around its spindle. A hand-sized box round each, unseen,
  // is what a click on the handle meets, easier to hit than the slim lever.
  const handleMetal = runtime.core.toon("#c4c8ce");
  const handleHitMat = runtime.core.track(new THREE.MeshBasicMaterial({ visible: false }));
  const HANDLE_Y = -GLASS.y * 0.35;
  const windowHandles = [];
  const windowCatches = [-1, 1].map((side, leaf) => {
    const x = side * (MULLION + SASH / 2);
    const plate = runtime.core.mesh(runtime.core.rbox(0.1, 0.34, 0.04, 0.02), handleMetal, { cast: false, outline: 0.01 });
    plate.position.set(x, HANDLE_Y, 0);
    const lever = runtime.core.mesh(runtime.core.rbox(0.06, 0.3, 0.04, 0.02), handleMetal, { cast: false, outline: 0.01 });
    lever.position.set(0, -0.13, 0);
    const handle = new THREE.Group();
    handle.position.set(x, HANDLE_Y + 0.08, 0.03);
    handle.add(lever);
    const hit = new THREE.Mesh(runtime.core.track(new THREE.BoxGeometry(0.4, 0.7, 0.3)), handleHitMat);
    hit.position.set(x, HANDLE_Y - 0.05, 0.1);
    const grip = new THREE.Group();
    grip.add(plate, handle, hit);
    windowHandles.push(onLeaf(leaf, grip));
    return handle;
  });
  // The room mirrored faintly in the glass: one broad soft band and a thin brighter one beside
  // it, leaning against the rain (which falls the other way, so the two never read as one),
  // soft at their edges and fading out top and bottom. Drawn once per leaf's whole glass, so
  // a band cut by a glazing bar carries on in the next pane, as it would on one sheet.
  const glareTex = canvasTexture(256, 512);
  runtime.core.track(glareTex.texture);
  const GLARE_LEAN = 0.6; // radians off vertical, top leaning left
  const glareBand = (x, width, peak) => {
    const g = glareTex.ctx;
    // three copies a tile apart, so the band wraps seamlessly as the hover slides it along
    [-256, 0, 256].forEach((dx) => {
      g.save();
      g.translate(x + dx, 256);
      g.rotate(-GLARE_LEAN);
      const across = g.createLinearGradient(-width / 2, 0, width / 2, 0);
      across.addColorStop(0, "rgba(255,255,255,0)");
      across.addColorStop(0.5, `rgba(255,255,255,${peak})`);
      across.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = across;
      g.fillRect(-width / 2, -400, width, 800);
      g.restore();
    });
  };
  glareBand(92, 74, 0.55);
  glareBand(148, 14, 0.8);
  glareBand(236, 34, 0.25);
  // fade the bands out along their length, strongest a little above the middle
  glareTex.ctx.globalCompositeOperation = "destination-in";
  const along = glareTex.ctx.createLinearGradient(0, 0, 0, 512);
  along.addColorStop(0, "rgba(0,0,0,0)");
  along.addColorStop(0.3, "rgba(0,0,0,1)");
  along.addColorStop(0.6, "rgba(0,0,0,.8)");
  along.addColorStop(1, "rgba(0,0,0,0)");
  glareTex.ctx.fillStyle = along;
  glareTex.ctx.fillRect(0, 0, 256, 512);
  glareTex.ctx.globalCompositeOperation = "source-over";
  // On the glass, behind the stiles and bars, one sheet per leaf (both sharing the material,
  // so the hover's sheen lights both). Added on, not laid over, so the view stays clear under
  // it; its colour (set with the room's light in theme) is how bright and warm it is.
  const glareMat = runtime.core.track(new THREE.MeshBasicMaterial({ map: glareTex.texture, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  glareTex.texture.wrapS = THREE.RepeatWrapping;
  const [windowGlare] = LEAVES.map(({ inner: [lx0, lx1, ly0, ly1] }, leaf) => {
    const glareGeo = mergeGeometries(leafPanes(leaf).map(([x0, x1, y0, y1]) =>
      new THREE.PlaneGeometry(x1 - x0, y1 - y0).translate((x0 + x1) / 2, (y0 + y1) / 2, 0)));
    // the texture spans the leaf's whole glass; the right leaf, hung at its own angle, shows
    // the reflection a little further along
    const position = glareGeo.attributes.position;
    for (let i = 0; i < position.count; i++) {
      glareGeo.attributes.uv.setXY(i, (position.getX(i) - lx0) / (lx1 - lx0) + leaf * 0.3, (position.getY(i) - ly0) / (ly1 - ly0));
    }
    const glare = new THREE.Mesh(runtime.core.track(glareGeo), glareMat);
    glare.position.z = -0.13;
    glare.raycast = runtime.core.noRaycast;
    return onLeaf(leaf, glare);
  });
  // Dedicated shadows for the glazing bars and blind, drawn only into the window light's
  // shadow map (skipped in every other
  // pass), so the sun doesn't see them and nothing of them shows. The light's cookie keeps
  // the beam inside the glass opening.
  const shadowOnly = runtime.core.track(new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: THREE.DoubleSide }));
  const skipDraw = (r, s, c, geometry) => geometry.setDrawRange(0, 0);
  const restoreDraw = (r, s, c, geometry) => geometry.setDrawRange(0, Infinity);
  const windowShadow = (geo) => {
    const m = new THREE.Mesh(geo, shadowOnly);
    m.castShadow = true;
    m.frustumCulled = false;
    m.raycast = runtime.core.noRaycast;
    m.userData.windowShadow = true;
    m.onBeforeShadow = (r, o, c, shadowCamera, g) => g.setDrawRange(0, shadowCamera === runtime.windowLighting.windowLight.shadow.camera ? Infinity : 0);
    m.onAfterShadow = (r, o, c, shadowCamera, g) => g.setDrawRange(0, Infinity);
    m.onBeforeRender = skipDraw;
    m.onAfterRender = restoreDraw;
    return m;
  };
  // The cookie's soft edge can spill beyond the opening. The wall must also block the
  // window light physically, including above the frame at midday. Keep its shadow geometry
  // separate: the shadow-only callbacks change its draw range.
  const windowWallShadow = windowShadow(runtime.core.track(sideWallGeo.clone()));
  windowWallShadow.position.copy(sideWall.position);
  room.add(windowWallShadow);
  // Each leaf's wood shadows the beam from the leaf, swinging with it; the middle post stays
  const shadowFrom = (shape) => runtime.core.at(windowShadow(runtime.core.track(new THREE.ShapeGeometry(shape))), 0, 0, -0.13);
  LEAVES.forEach(({ outer }, leaf) => onLeaf(leaf, shadowFrom(cutOut(outer, leafPanes(leaf)))));
  windowGroup.add(shadowFrom(rect(new THREE.Shape(), [-MULLION, MULLION, -GLASS.y, GLASS.y])));

  // Public state used by the other scene parts.
  return {
    desk,
    windowGroup,
    windowShadow,
    WINDOW_DEPTH,
    brass,
    shadowOnly,
    outside,
    dayPart,
    SIDE_X,
    WINDOW_AT,
    GLASS,
    PANES,
    windowCatches,
    windowHandles,
    leaves,
    windowGlare,
    glareTex,
    room,
    WALL_Z,
    FLOOR_Y,
    WALL_LIFT,
    windowWood,
    neonLight,
    stripLight,
    backWallMat,
    sideWallMat,
    wallPaint,
    sideWallPaint,
    deskWood,
    deskMat,
    frameGrainTex,
    frameWood,
    deskNeons,
    DESK_WASH,
    shadowedNeons,
    floorMat,
    floorWood,
    roomBackground,
    trimMat,
    get diorama() { return diorama; },
    drawBackdrop,
    windowView,
    get daylightPart() { return daylightPart; },
    set daylightPart(value) { daylightPart = value; },
    daylightParts,
    DIORAMA,
    setDiorama,
    backdrop,
    get dioramaShadowFor() { return dioramaShadowFor; },
    set dioramaShadowFor(value) { dioramaShadowFor = value; },
    shapeDioramaShadow,
    dioramaShadow,
    updateNeonLights,
    neonLights,
  };
}
