import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { canvasTexture, SIP_QUOTES, drawCoffeeTop, drawCork } from "../textures";

export function createCoffee(runtime) {
  // ---------- mug (decor) ----------
  const mug = new THREE.Group();
  // On a cork coaster, a little further back toward the monitor
  const MUG_Y = 0.06;
  mug.position.set(5.75, MUG_Y, 0.9);
  const corkTex = canvasTexture(256, 256);
  runtime.core.track(corkTex.texture);
  drawCork(corkTex.ctx, 256, 256);
  const corkMat = runtime.core.toon("#ffffff");
  corkMat.map = corkTex.texture;
  const coaster = runtime.core.mesh(new THREE.CylinderGeometry(0.74, 0.74, 0.06, 32), corkMat, { outline: 0.03, cast: false });
  coaster.position.set(mug.position.x, 0.03, mug.position.z);
  const coasterRing = new THREE.Mesh(runtime.core.track(new THREE.TorusGeometry(0.6, 0.02, 6, 40)), runtime.core.toon("#6e4520"));
  coasterRing.receiveShadow = true;
  coasterRing.rotation.x = Math.PI / 2;
  coasterRing.position.set(mug.position.x, 0.062, mug.position.z);
  coasterRing.raycast = runtime.core.noRaycast;
  runtime.core.scene.add(coaster, coasterRing);
  runtime.core.scene.add(mug);
  // Hollow cup (lathe profile with a wall), deep enough for the coffee level to drop
  const CUP_FLOOR = 0.12;
  const mugProfile = [
    [0, 0],
    [0.45, 0],
    [0.5, 1.1],
    [0.43, 1.1],
    [0.39, CUP_FLOOR],
    [0, CUP_FLOOR],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  // Open-ended: caps on the outline shell showed as a dark ring inside the opening
  const mugShell = new THREE.CylinderGeometry(0.5, 0.45, 1.1, 32, 1, true);
  mugShell.translate(0, 0.55, 0);
  const mugMat = runtime.core.toon("#fffdf5");
  const mugBody = runtime.core.mesh(new THREE.LatheGeometry(mugProfile, 32), mugMat, { outline: 0.05, hull: mugShell });
  // The opening's edge: the outer outline only traces the silhouette
  const rimLine = new THREE.Mesh(runtime.core.track(new THREE.TorusGeometry(0.43, 0.012, 6, 48)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#000000" })));
  rimLine.rotation.x = Math.PI / 2;
  rimLine.position.y = 1.1;
  rimLine.raycast = runtime.core.noRaycast;
  // the coffee's top (drawCoffeeTop): crema in two tones with a layered latte-art heart
  const coffeeTex = canvasTexture(512, 512);
  runtime.core.track(coffeeTex.texture);
  drawCoffeeTop(coffeeTex.ctx, 512, 512);
  const coffeeMat = runtime.core.toon("#ffffff");
  coffeeMat.map = coffeeTex.texture;
  const coffee = runtime.core.mesh(new THREE.CylinderGeometry(0.405, 0.405, 0.02, 32), coffeeMat, { outline: 0, cast: false });
  coffee.position.y = 0.93;
  const handle = runtime.core.mesh(new THREE.TorusGeometry(0.28, 0.08, 10, 20, Math.PI), mugMat, { outline: 0.04 });
  handle.rotation.z = -Math.PI / 2;
  handle.position.set(0.46, 0.58, 0);
  // Steam: little cartoon puffs rising off the coffee, inked like everything else on the desk.
  // Each puff is a lumpy cloud that buds small at the surface, swells as it climbs, leans off
  // to the right (away from the phone behind the mug) and shrinks away near the top. All the
  // ink goes down first and the fills over it, so puffs that touch merge into one outlined
  // cloud, with a grey underside for a toon shade.
  const STEAM_W = 256;
  const STEAM_H = 256;
  const STEAM_SCALE = { x: 1.9, y: 1.9 };
  const STEAM_SCALE_HOVER = { x: 2.15, y: 2.15 };
  const steamTex = canvasTexture(STEAM_W, STEAM_H);
  runtime.core.track(steamTex.texture);
  const steam = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map: steamTex.texture, transparent: true, depthWrite: false })));
  steam.raycast = runtime.core.noRaycast;
  steam.center.set(0.5, 0);
  steam.scale.set(STEAM_SCALE.x, STEAM_SCALE.y, 1);
  steam.position.set(0, 0.9, 0);
  mug.add(steam);
  const puffs = [steam];
  const STEAM_PERIOD = 5.5;
  const STEAM_PUFFS = 4;
  // where puffs bud (a share of the width), how far right they've drifted by the top, and how
  // big they get (a share of the width)
  const STEAM_FROM = 0.42;
  const STEAM_LEAN = 0.52;
  const STEAM_R = 0.1;
  const STEAM_INK = 6;
  // the lumps of one puff: offset and radius, as shares of its size
  const PUFF_LOBES = [[0, 0, 1], [-0.62, 0.22, 0.68], [0.6, 0.28, 0.62], [0.08, -0.5, 0.6]];
  let steamDrawnAt = 0;
  function updateSteam(now) {
    if (!steam.visible || now - steamDrawnAt < 33) return;
    steamDrawnAt = now;
    const c = steamTex.ctx;
    c.clearRect(0, 0, STEAM_W, STEAM_H);
    const t = now / 1000;
    const lumps = [];
    for (let i = 0; i < STEAM_PUFFS; i++) {
      const p = (t / STEAM_PERIOD + i / STEAM_PUFFS) % 1;
      // buds, swells, then shrinks away as it nears the top
      const size = STEAM_R * STEAM_W * Math.min(1, 0.35 + p / 0.25) * Math.min(1, (1 - p) / 0.4);
      if (size < 1) continue;
      // drifting off to the right more and more as it rises, a curl rather than a slant
      const x = (STEAM_FROM + p * p * STEAM_LEAN + Math.sin(p * 5 + i * 2.1) * 0.03) * STEAM_W;
      const y = STEAM_H - size - 4 - p * (STEAM_H - 2 * STEAM_R * STEAM_W);
      // each puff turns a little as it rises, so its lumps don't sit still
      const spin = i * 1.7 + p * 1.2;
      PUFF_LOBES.forEach(([dx, dy, r]) => {
        const cos = Math.cos(spin * 0.4);
        const sin = Math.sin(spin * 0.4);
        lumps.push([x + (dx * cos - dy * sin) * size, y + (dx * sin + dy * cos) * size, r * size]);
      });
    }
    const fill = (color, grow, shift) => {
      c.fillStyle = color;
      lumps.forEach(([x, y, r]) => {
        c.beginPath();
        c.arc(x + shift * r, y + shift * r, Math.max(0, r + grow * (shift ? r : 1)), 0, Math.PI * 2);
        c.fill();
      });
    };
    fill("#1a1714", STEAM_INK, 0);
    fill("#cfd6df", 0, 0);
    // the lit part, nudged up and left, leaves the grey showing on the underside
    fill("#ffffff", -0.18, -0.12);
    steamTex.texture.needsUpdate = true;
  }

  mug.add(mugBody, rimLine, coffee, handle);

  // Sipping: each click drinks a bit and a quote pops up over the mug. Finish the cup and the
  // desk switches to the night shift (or back to day), then it's refilled.
  const SIPS = 4;
  let sipsLeft = SIPS;
  let sipping = false;
  function setCoffee(level, duration = 0.5) {
    const y = CUP_FLOOR + 0.02 + level * (0.93 - CUP_FLOOR - 0.02);
    const r = 0.39 + (0.04 * (y - CUP_FLOOR)) / (1.1 - CUP_FLOOR) - 0.005;
    gsap.to(coffee.position, { y, duration });
    gsap.to(coffee.scale, { x: r / 0.405, z: r / 0.405, duration });
    // Steam only rises off a full cup
    puffs.forEach((puff) => (puff.visible = level >= 1));
  }
  // Move back as well as up: the high camera angle compresses vertical separation.
  // Just above and left of the mug as the (mostly top-down) mug shot sees it, tail to the rim
  const mugBubble = runtime.core.speechBubble(1.9, 1.0);
  mugBubble.sprite.position.set(mug.position.x - 0.5, MUG_Y + 1.85, mug.position.z - 1.1);
  const say = mugBubble.say;
  const hideBubble = mugBubble.hide;
  let lastQuote = -1;

  function sip() {
    if (sipping || sipsLeft === 0) return;
    sipping = true;
    gsap.killTweensOf(mug.position);
    // No steam while it's at your lips (nor after: it's no longer full)
    puffs.forEach((puff) => (puff.visible = false));
    // Lift and tip the rim toward you, then put it back down
    gsap
      .timeline({ onComplete: () => (sipping = false) })
      .to(mug.position, { y: MUG_Y + 0.7, duration: 0.3, ease: "power2.out" })
      .to(mug.rotation, { x: 0.55, duration: 0.3, ease: "power2.out" }, 0)
      .to(mug.rotation, { x: 0, duration: 0.3, ease: "power2.inOut" }, 0.95)
      .to(mug.position, { y: MUG_Y, duration: 0.35, ease: "bounce.out" }, 1.0);
    // The slurp starts as the rim reaches your lips; the mug is set down after the gulp
    sfx.slurp({ delay: 0.25 });
    runtime.core.timers.push(setTimeout(() => sfx.mugDown({ strength: 0.35 }), 1200));
    sipsLeft--;
    runtime.core.timers.push(setTimeout(() => setCoffee(sipsLeft / SIPS, 0.4), 350));
    if (sipsLeft > 0) {
      let i;
      do i = Math.floor(Math.random() * SIP_QUOTES.length);
      while (i === lastQuote && SIP_QUOTES.length > 1);
      lastQuote = i;
      say(SIP_QUOTES[i]);
    } else {
      const toNight = !runtime.theme.darkNow;
      say(toNight ? { text: "Cup's empty. Night shift it is.", by: "oka" } : { text: "Last sip. Good morning, world!", by: "oka" });
      runtime.core.timers.push(setTimeout(() => runtime.options.onEvent("nightShift", { dark: toNight }), 1300));
      // Refill
      runtime.core.timers.push(
        setTimeout(() => {
          sipsLeft = SIPS;
          setCoffee(1, 1.2);
          sfx.rustle({ duration: 1 });
        }, 2600),
      );
    }
    runtime.options.onEvent("mug");
  }
  runtime.core.register(mug, {
    focus: "mug",
    onHover: (on) => {
      if (sipping) return;
      gsap.to(mug.position, { y: on ? MUG_Y + 0.06 : MUG_Y, duration: 0.3, ease: "power2.out", overwrite: true });
      gsap.to(steam.scale, { ...(on ? STEAM_SCALE_HOVER : STEAM_SCALE), duration: 0.4, overwrite: true });
      if (on) gsap.fromTo(coffee.rotation, { y: -0.25 }, { y: 0, duration: 0.7, ease: "elastic.out(1, 0.4)", overwrite: true });
      // the coffee rocks in the cup
      if (on) hoverSound(mug, (s) => s.slosh());
    },
    onArrive: sip,
    onClick: sip,
    onLeave: () => {
      hideBubble();
      if (!sipping) {
        gsap.to(mug.position, { y: MUG_Y, duration: 0.2 });
        gsap.to(mug.scale, { x: 1, y: 1, z: 1, duration: 0.2 });
      }
    },
  });

  // Lightweight contact-shadow approximations supplement the directional shadows: a soft dark
  // footprint under each prop, and behind what hangs on the walls. They're all instances of one
  // decal, a single draw call however many there are. The shader draws the shape: an oval, or a
  // soft-cornered box for square furniture and frames.
  const CONTACT_MAX = 64;
  const contactGeometry = runtime.core.track(new THREE.PlaneGeometry(1, 1));
  const contactAlpha = new THREE.InstancedBufferAttribute(new Float32Array(CONTACT_MAX), 1).setUsage(THREE.DynamicDrawUsage);
  const contactBox = new THREE.InstancedBufferAttribute(new Float32Array(CONTACT_MAX), 1);
  const contactCanopy = new THREE.InstancedBufferAttribute(new Float32Array(CONTACT_MAX), 1);
  contactGeometry.setAttribute("contactCanopy", contactCanopy);
  contactGeometry.setAttribute("contactAlpha", contactAlpha);
  contactGeometry.setAttribute("contactBox", contactBox);
  const contactMaterial = runtime.core.track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: `
      attribute float contactAlpha;
      attribute float contactBox;
      attribute float contactCanopy;
      varying vec2 vPlace;
      varying float vAlpha;
      varying float vBox;
      varying float vCanopy;
      void main() {
        vPlace = uv * 2.0 - 1.0;
        vAlpha = contactAlpha;
        vBox = contactBox;
        vCanopy = contactCanopy;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vPlace;
      varying float vAlpha;
      varying float vBox;
      varying float vCanopy;
      void main() {
        vec2 p = abs(vPlace);
        // 0 at the centre, 1 at the rim: an oval, or a box whose flat core spans 35% of it
        float d = mix(length(p), length(max(p - 0.35, 0.0)) / 0.65, vBox);
        // Solid dark over its middle half, where the prop's foot stands, then fading out to the
        // rim: darkest at the contact, and that darkness reaches out past the prop's edge where
        // it shows. Eased at both ends, so there's no crease where the core gives way and no
        // edge at the rim.
        float shade = pow(1.0 - smoothstep(0.5, 1.0, d), 1.3);
        // The top shelters the rear more than the open front. +y on this floor plane points
        // toward the back wall; keep the light-driven footprint while grading its darkness.
        float shelter = 0.55 + 0.75 * smoothstep(-0.7, 0.7, vPlace.y);
        float underWall = step(1.5, vCanopy);
        shade *= mix(1.0, shelter, clamp(vCanopy, 0.0, 1.0) * (1.0 - underWall));
        // On the back wall, shade starts at the underside and fades down toward the floor.
        float wallShade = (1.0 - smoothstep(0.65, 1.0, p.x)) * smoothstep(-1.0, 0.85, vPlace.y);
        shade = mix(shade, wallShade, underWall);
        // A gradient this faint steps visibly in 8 bits; half a step of screen-space noise
        // dithers the bands away
        float noise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
        gl_FragColor = vec4(0.0, 0.0, 0.0, max(shade * vAlpha + step(0.001, shade) * (noise - 0.5) / 255.0, 0.0));
      }`,
  }));
  const contactDecals = runtime.core.track(new THREE.InstancedMesh(contactGeometry, contactMaterial, CONTACT_MAX));
  contactDecals.count = 0;
  contactDecals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // (its instances spread across the whole room)
  contactDecals.frustumCulled = false;
  contactDecals.raycast = runtime.core.noRaycast;
  runtime.core.scene.add(contactDecals);
  const contactShadows = [];
  const inScene = (object) => {
    while (object.parent) object = object.parent;
    return object === runtime.core.scene;
  };
  const addContact = (entry) => {
    // a prop kept out of the scene while hidden gets none
    if (!inScene(entry.object) || contactShadows.length === CONTACT_MAX) return;
    contactBox.setX(contactShadows.length, entry.box ? 1 : 0);
    contactCanopy.setX(contactShadows.length, entry.underDeskWall ? 2 : entry.canopy ? 1 : 0);
    contactShadows.push({ size: 1, ...entry });
    contactDecals.count = contactShadows.length;
  };
  // Under a prop, on the surface it stands on. `anchor` offsets it from the prop's origin when
  // that isn't over its foot. Lifted props get a wider, fainter footprint.
  // (drawn 1.4 times the footprint given, so the prop's edge falls within the solid core and
  // the fade shows round it)
  const CONTACT_REACH = 1.4;
  const contactShadow = (object, width, depth, surfaceY = 0, strength = 1, { box = false, anchor = null } = {}) =>
    addContact({ object, width: width * CONTACT_REACH, depth: depth * CONTACT_REACH, surfaceY, strength, box, anchor, baseY: object.position.y });
  // Under something paper-thin lying flat (a ticket, an envelope): nothing stands up to block
  // the light, so only a thin, faint line of shade shows along its edges
  const flatShadow = (object, width, depth, surfaceY = 0) =>
    addContact({ object, width: width * 1.12, depth: depth * 1.12, surfaceY, strength: 0.35, box: true, anchor: null, baseY: object.position.y });
  const bounds = new THREE.Box3();
  const boundsOf = (object) => {
    object.updateWorldMatrix(true, true);
    bounds.setFromObject(object);
    return { centre: bounds.getCenter(new THREE.Vector3()), size: bounds.getSize(new THREE.Vector3()) };
  };
  // Round the foot of floor furniture, sized from its bounds
  const floorShadow = (object, strength, { box = false, pad = 1.2 } = {}) => {
    const { centre, size } = boundsOf(object);
    contactShadow(object, size.x * pad, size.z * pad, runtime.room.FLOOR_Y, strength, { box, anchor: centre.sub(object.position) });
  };
  // On a shelf board, for what stands there (the consoles, the robot, a row of game cases): in
  // the bookcase's own space, which is scaled, and kept inside the board's top so no shade
  // hangs off its front edge into the air. Snug to the foot (1.15 times it, not the 1.4 a
  // desk prop gets), and fainter, the bay being dim and already shaded. `follow` false keeps
  // a row's shade put while one piece of it is lifted out.
  const SHELF_INSIDE = { x: runtime.shelf.SHELF_W / 2 - 0.22, front: runtime.shelf.SHELF_D / 2, back: -runtime.shelf.SHELF_D / 2 + 0.12 };
  const shelfShadow = (objects, level, strength, { follow = true, box = false } = {}) => {
    const bookcase = runtime.shelf.shelf;
    bookcase.updateWorldMatrix(true, true);
    bounds.makeEmpty();
    objects.forEach((o) => bounds.expandByObject(o));
    const centre = bookcase.worldToLocal(bounds.getCenter(new THREE.Vector3()));
    const size = bounds.getSize(new THREE.Vector3()).divideScalar(bookcase.scale.x);
    const [object] = objects;
    addContact({
      object, shelfAt: runtime.shelf.standOn(level), follow, strength, box,
      local: new THREE.Vector3(centre.x - object.position.x, 0, centre.z - object.position.z),
      width: size.x * 1.15, depth: size.z * 1.15, baseY: object.position.y, restX: object.position.x, restZ: object.position.z,
    });
  };
  // Something that moves about the room on its own (the cat, a dumbbell in a rep, crumpled
  // paper): its shade lies on whatever it's over, the highest surface it could rest on that's
  // below it, and fades and spreads as it rises off that. `rise` is how far its origin sits
  // above the surface when it rests there; `when` says whether it's out to cast one at all.
  const roamingShadow = (object, width, depth, strength, { rise = 0, when = null } = {}) =>
    addContact({ object, roam: true, rise, when, width: width * CONTACT_REACH, depth: depth * CONTACT_REACH, strength, anchor: null });
  const supportBox = (box) => (x, z) => (x > box.min.x && x < box.max.x && z > box.min.z && z < box.max.z ? box.max.y : null);
  const supportSeat = new THREE.Vector3();
  const supportPerch = new THREE.Vector3();
  const supports = [
    supportBox(new THREE.Box3().setFromObject(runtime.wallDecor.rugTop)),
    supportBox(new THREE.Box3().setFromObject(runtime.room.desk)),
    // the chair's seat, wherever it's turned
    (x, z) => {
      runtime.chair.chairTop.localToWorld(supportSeat.set(0, runtime.chair.SEAT_TOP, 0));
      return Math.hypot(x - supportSeat.x, z - supportSeat.z) < 2.2 ? supportSeat.y : null;
    },
    // the bed on top of the cat tree
    (x, z) => {
      runtime.catTree.tree.localToWorld(supportPerch.copy(runtime.catTree.PERCH));
      return Math.hypot(x - supportPerch.x, z - supportPerch.z) < 1.7 ? supportPerch.y - 0.02 : null;
    },
  ];
  const supportUnder = (x, y, z) => supports.reduce((top, at) => {
    const h = at(x, z);
    return h !== null && h <= y + 0.05 && h > top ? h : top;
  }, runtime.room.FLOOR_Y);
  const roamAt = new THREE.Vector3();
  const roamTurn = new THREE.Quaternion();
  const roamEuler = new THREE.Euler(0, 0, 0, "YXZ");
  // Behind something hung on the back or side wall. `swing` is the part of it that sways, which
  // the shadow follows.
  const wallShadow = (object, wall, strength, { box = true, swing = object } = {}) => {
    const { centre, size } = boundsOf(object);
    swing.updateWorldMatrix(true, false);
    addContact({ object, wall, strength, box, swing, centre: swing.worldToLocal(centre), width: (wall === "side" ? size.z : size.x) * 1.05, depth: size.y * 1.05 });
  };

  const contactMatrix = new THREE.Matrix4();
  const contactStretch = new THREE.Matrix4();
  const contactTurn = new THREE.Quaternion();
  const contactEuler = new THREE.Euler();
  const contactPlace = new THREE.Vector3();
  const contactScale = new THREE.Vector3();
  const toSun = new THREE.Vector3();
  const keyAt = new THREE.Vector3();
  const keyLean = { x: 0, z: 0, weight: 0 };
  const NO_LEAN = { x: 0, z: 0, weight: 0 };
  const SIDE_WALL_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const NO_TURN = new THREE.Quaternion();
  function updateContactShadows() {
    const beam = runtime.windowLighting.windowLight;
    const night = runtime.core.roomLight.night;
    // A contact shadow is its own element, drawn bold enough to read as the prop resting on
    // the surface (as cel animation does: Petrovic et al. 2000): the darkest value sits right
    // at the contact, 50% at its core by day (about a fifth to a third darker round the prop's
    // foot, as in a pale room lit through a window), fainter by night and under cloud, where
    // the light is flatter
    const contact = THREE.MathUtils.lerp(0.5, 0.38, night) * (1 - 0.2 * runtime.room.outside.rain);
    // Direct sun through the window: the beam's strength (rain has already dimmed it), less
    // what the blind holds back
    const direct = THREE.MathUtils.clamp(beam.intensity / 4.1, 0, 1) * (1 - night) * THREE.MathUtils.smoothstep(runtime.windowBlind.blind.lift, 0, 0.6);
    // Every footprint leans away from one key light, so the room's shadows all agree on where
    // the light comes from: by day the window (the sky through it, core.sun, from a bright day's
    // 1 down to a drawn blind's), by night the desk lamp when it's lit. The lean is firm near the
    // key and fades across the room, where its light has evened out.
    const sky = runtime.core.sun;
    const skyGlow = THREE.MathUtils.clamp(sky.intensity / (0.65 * runtime.core.SKY_REACH), 0, 1);
    const lamp = runtime.lamp.lampLight;
    const lampGlow = THREE.MathUtils.clamp(lamp.intensity / 8, 0, 1) * night;
    const lampKey = lampGlow > skyGlow;
    if (lampKey) lamp.getWorldPosition(keyAt);
    else keyAt.copy(sky.position);
    const keyGlow = lampKey ? lampGlow : skyGlow;
    const keyReach = lampKey ? 6 : 10;
    const leanFrom = (x, z) => {
      const dx = x - keyAt.x;
      const dz = z - keyAt.z;
      const d = Math.hypot(dx, dz) || 1;
      return Object.assign(keyLean, { x: dx / d, z: dz / d, weight: keyGlow * Math.min(1, keyReach / d) });
    };
    toSun.subVectors(beam.position, beam.target.position);
    const across = Math.hypot(toSun.x, toSun.z) || 1;
    // How far a shadow falls per unit of height: 1 under the 45° noon sun, about 2 at sunrise
    // and sunset
    const reach = THREE.MathUtils.clamp(across / Math.max(toSun.y, 1e-3), 0.5, 2.2);
    const fallX = -toSun.x / across;
    const fallZ = -toSun.z / across;
    contactShadows.forEach((entry, i) => {
      const { object } = entry;
      if (!object.visible || entry.size < 0.002 || (entry.when && !entry.when())) {
        contactDecals.setMatrixAt(i, contactMatrix.makeScale(0, 0, 0));
        return;
      }
      if (entry.underDeskWall) {
        object.getWorldPosition(contactPlace);
        const underside = contactPlace.y - entry.thickness / 2;
        const height = Math.max(0.01, underside - runtime.room.FLOOR_Y);
        const lean = leanFrom(contactPlace.x, runtime.room.WALL_Z);
        const x = contactPlace.x + lean.x * lean.weight * 0.35;
        const width = Math.min(entry.width, 2 * Math.max(0, x - runtime.room.SIDE_X - 0.13));
        contactMatrix.compose(contactPlace.set(x, underside - height / 2, runtime.room.WALL_Z + 0.125), NO_TURN, contactScale.set(width, height, 1));
        contactDecals.setMatrixAt(i, contactMatrix);
        const sunWeight = lampKey ? 0 : direct;
        // (a little deeper by day, when the room is bright enough for the shelter to show)
        contactAlpha.setX(i, (0.06 + 0.04 * (1 - night) + 0.12 * Math.max(skyGlow, lampGlow) + 0.07 * sunWeight) * (1 - 0.35 * runtime.room.outside.rain));
        return;
      }
      if (entry.canopy) {
        // Broad occlusion from the top supplements the real cast shadows. Blend the diffuse
        // key with the actual sun direction; a low sun spreads the shade farther across the rug.
        object.getWorldPosition(contactPlace);
        const lean = leanFrom(contactPlace.x, contactPlace.z);
        const sunWeight = lampKey ? 0 : direct;
        const dx = THREE.MathUtils.lerp(lean.x * lean.weight, fallX, sunWeight);
        const dz = THREE.MathUtils.lerp(lean.z * lean.weight, fallZ, sunWeight);
        const length = 0.7 + 1.1 * reach * sunWeight;
        const x = contactPlace.x + dx * length;
        const z = contactPlace.z + dz * length;
        // Keep the soft footprint inside the floor's back/side walls, including phone dioramas.
        const width = Math.min(entry.width + Math.abs(dx) * reach * sunWeight, 2 * Math.max(0, x - runtime.room.SIDE_X - 0.13));
        const depth = Math.min(entry.depth + Math.abs(dz) * reach * sunWeight, 2 * Math.max(0, z - runtime.room.WALL_Z - 0.13));
        contactTurn.setFromEuler(contactEuler.set(-Math.PI / 2, 0, 0));
        contactMatrix.compose(contactPlace.set(x, entry.surfaceY + 0.008, z), contactTurn, contactScale.set(width, depth, 1));
        contactDecals.setMatrixAt(i, contactMatrix);
        const key = Math.max(skyGlow, lampGlow);
        // The bright daytime room otherwise washes the rug under the top out to the open rug's
        // grey, and the desk floats; by night the room is dark enough on its own.
        contactAlpha.setX(i, (0.08 + 0.07 * (1 - night) + 0.16 * key + 0.12 * sunWeight) * (1 - 0.35 * runtime.room.outside.rain));
        return;
      }
      if (entry.shelfAt !== undefined) {
        const bookcase = runtime.shelf.shelf;
        const lift = entry.follow ? Math.max(0, object.position.y - entry.baseY) : 0;
        const x = (entry.follow ? object.position.x : entry.restX) + entry.local.x;
        const z = (entry.follow ? object.position.z : entry.restZ) + entry.local.z;
        const spread = (1 + lift * 0.3) * entry.size;
        // trimmed to the board, never pushed off it
        const halfW = Math.min(entry.width * spread / 2, SHELF_INSIDE.x - Math.abs(x));
        const halfD = Math.min(entry.depth * spread / 2, SHELF_INSIDE.front - z, z - SHELF_INSIDE.back);
        if (halfW <= 0.01 || halfD <= 0.01) {
          contactDecals.setMatrixAt(i, contactMatrix.makeScale(0, 0, 0));
          return;
        }
        bookcase.localToWorld(contactPlace.set(x, entry.shelfAt + 0.004, z));
        contactTurn.setFromEuler(contactEuler.set(-Math.PI / 2, 0, -object.rotation.y));
        contactMatrix.compose(contactPlace, contactTurn, contactScale.set(halfW * 2 * bookcase.scale.x, halfD * 2 * bookcase.scale.z, 1));
        contactDecals.setMatrixAt(i, contactMatrix);
        contactAlpha.setX(i, contact * 0.7 * entry.strength / (1 + lift * 3));
        return;
      }
      if (entry.wall) {
        // Pressed against the wall, a little below what casts it (the light comes from above)
        // and along the wall away from the key
        entry.swing.localToWorld(contactPlace.copy(entry.centre));
        const lean = leanFrom(contactPlace.x, contactPlace.z);
        contactPlace.y -= entry.depth * 0.08;
        if (entry.wall === "side") {
          contactPlace.x = runtime.room.SIDE_X + 0.13;
          contactPlace.z += lean.z * lean.weight * 0.15 * entry.width;
        } else {
          contactPlace.z = runtime.room.WALL_Z + 0.13;
          contactPlace.x += lean.x * lean.weight * 0.15 * entry.width;
        }
        contactMatrix.compose(contactPlace, entry.wall === "side" ? SIDE_WALL_TURN : NO_TURN, contactScale.set(entry.width * entry.size, entry.depth * entry.size, 1));
        contactDecals.setMatrixAt(i, contactMatrix);
        // (a hung piece stands off the wall, so its shade is fainter than a footprint's, and
        // kept mostly behind it: a dark rim round its edge would read as a heavier outline)
        contactAlpha.setX(i, 0.3 * contact * entry.strength * (0.85 + 0.3 * lean.weight));
        return;
      }
      let footX = object.position.x + (entry.anchor?.x ?? 0);
      let footZ = object.position.z + (entry.anchor?.z ?? 0);
      let surfaceY = entry.surfaceY;
      let lift = Math.max(0, object.position.y - entry.baseY);
      let yaw = object.rotation.y;
      if (entry.roam) {
        object.getWorldPosition(roamAt);
        footX = roamAt.x;
        footZ = roamAt.z;
        surfaceY = supportUnder(roamAt.x, roamAt.y - entry.rise, roamAt.z);
        lift = Math.max(0, roamAt.y - entry.rise - surfaceY);
        yaw = roamEuler.setFromQuaternion(object.getWorldQuaternion(roamTurn), "YXZ").y;
      }
      // The window's sun reaches the desktop, not the floor under it. A high sun keeps the
      // footprint tight and dark; a low one draws it out, away from the window.
      const lit = surfaceY > runtime.room.FLOOR_Y + 1 ? direct : 0;
      const lean = entry.fixedContact ? NO_LEAN : leanFrom(footX, footZ);
      const leanBy = lean.weight * 0.18 * (entry.width + entry.depth) / 2;
      const pull = lit * 0.07 * reach * (entry.width + entry.depth) / 2;
      // drawn out along where it falls: by the key's lean, and further by a low sun on the desk
      const towardX = fallX * pull + lean.x * leanBy;
      const towardZ = fallZ * pull + lean.z * leanBy;
      const toward = Math.hypot(towardX, towardZ) || 1;
      const alongX = towardX / toward;
      const alongZ = towardZ / toward;
      const stretch = lit * 0.15 * (reach - 1) + 0.3 * lean.weight;
      contactTurn.setFromEuler(contactEuler.set(-Math.PI / 2, 0, -yaw));
      const spread = (1 + lift * 0.3) * entry.size;
      contactMatrix.compose(contactPlace.set(0, 0, 0), contactTurn, contactScale.set(entry.width * spread, entry.depth * spread, 1));
      contactStretch.set(
        1 + stretch * alongX * alongX, 0, stretch * alongX * alongZ, 0,
        0, 1, 0, 0,
        stretch * alongX * alongZ, 0, 1 + stretch * alongZ * alongZ, 0,
        0, 0, 0, 1,
      );
      contactMatrix.premultiply(contactStretch).setPosition(footX + towardX, surfaceY + 0.008, footZ + towardZ);
      contactDecals.setMatrixAt(i, contactMatrix);
      // (capped short of black: a prop in the sun on the desk would otherwise stand in a flat
      // black blot)
      contactAlpha.setX(i, Math.min(0.9, contact * entry.strength * (0.85 + 0.3 * lean.weight) * (1 + lit * 0.45 / reach) / (1 + lift * 3)));
    });
    contactDecals.instanceMatrix.needsUpdate = true;
    contactAlpha.needsUpdate = true;
  }

  contactShadow(mug, 1.55, 1.55);
  contactShadow(runtime.plant.plant, 1.9, 1.9);
  contactShadow(runtime.mouse.mouse, 1.1, 1.8, runtime.keyboard.MAT_TOP);
  contactShadow(runtime.workstation.monitor, 3.2, 2.2, runtime.workstation.RISER_TOP);
  contactShadow(runtime.workstation.macMini, 1.5, 1.5, runtime.workstation.RISER_TOP, 0.8);
  contactShadow(runtime.workstation.riser, 12.2, 2.8, 0, 0.7);
  contactShadow(runtime.keyboard.keyboard, 5.8 * runtime.keyboard.KEYBOARD_SCALE, 2.5 * runtime.keyboard.KEYBOARD_SCALE, runtime.keyboard.MAT_TOP, 0.8);
  contactShadow(runtime.chat.phoneStand, 1.7, 1.5);
  // (the two passes fanned out, and the envelope, as laid on the desk)
  flatShadow(runtime.tickets.tickets, 2.6, 1.5);
  contactShadow(runtime.projectFiles.folders, runtime.projectFiles.FOLDER_W * 1.35, runtime.projectFiles.FOLDER_D * 1.35, 0, 0.7);
  flatShadow(runtime.postcard.mail, 1.62, 1.14);
  contactShadow(runtime.chair.chair, 7.2, 7.2, runtime.room.FLOOR_Y + 0.08, 0.8);
  contactShadow(runtime.lamp.lamp, 1.6, 1.6, 0, 0.8, { anchor: runtime.lamp.LAMP_BASE });
  contactShadow(runtime.lamp.familyFrame, 1.5, 0.9, 0, 0.6, { box: true });
  runtime.workstation.speakers.forEach(({ group }) => contactShadow(group, 1.9, 2.4, runtime.workstation.RISER_TOP, 0.7, { box: true }));
  floorShadow(runtime.shelf.shelf, 0.8, { box: true, pad: 1.1 });
  floorShadow(runtime.catTree.tree, 0.8, { box: true });
  // each dumbbell along its bar, lifting with it in a rep (its origin rides a head's radius up)
  runtime.gym.gym.children.filter((db) => db.userData.restY !== undefined).forEach((db) =>
    roamingShadow(db, 1.0 * runtime.gym.gym.scale.x, 0.45 * runtime.gym.gym.scale.x, 0.8, { rise: db.userData.restY * runtime.gym.gym.scale.y }));
  // The tabletop shelters a broad patch of floor/rug, beyond the small contacts at its feet.
  const deskFootprint = boundsOf(runtime.room.desk).size;
  addContact({ object: runtime.room.desk, width: deskFootprint.x * 1.08, depth: deskFootprint.z * 1.16,
    surfaceY: runtime.room.FLOOR_Y + 0.07, canopy: true, box: true });
  addContact({ object: runtime.room.desk, width: deskFootprint.x, thickness: deskFootprint.y, underDeskWall: true });
  // the desk's two columns, on their T-feet
  [-7.3, 5.3].forEach((x) => {
    const foot = new THREE.Object3D();
    foot.position.set(x, runtime.room.FLOOR_Y, 0.2);
    runtime.core.scene.add(foot);
    // The long T-foot is flush to the rug. Its contact must stay under it: the generic
    // light-driven lean used its long depth and displaced a dark patch beside the narrow foot.
    addContact({ object: foot, width: 0.78, depth: 7.8, surfaceY: runtime.room.FLOOR_Y + 0.08,
      strength: 0.28, box: true, baseY: foot.position.y, fixedContact: true });
  });
  // the cat, wherever she is: floor, rug, desk, chair or the tree's bed
  roamingShadow(runtime.cat.catModel, 1.9, 1.1, 0.75);
  // crumpled paper out on the floor or in the air, not in the bin
  runtime.wastebasket.papers.forEach((paper) =>
    roamingShadow(paper.ball, 0.55, 0.55, 0.7, { rise: 0.3, when: () => paper.state !== "idle" && paper.state !== "leaving" }));
  floorShadow(runtime.wastebasket.bin, 0.8);
  // Along the bookcase's boards, bottom to top
  const shelfItem = (sound) => runtime.shelf.shelfItems.filter((item) => item.sound === sound).map((item) => item.obj);
  shelfItem("robot").forEach((robot) => shelfShadow([robot], 0, 0.8));
  shelfItem("figure").forEach((figure) => shelfShadow([figure], 0, 0.8));
  shelfShadow(shelfItem("case"), 0, 0.7, { follow: false, box: true });
  shelfShadow(shelfItem("book"), 1, 0.7, { follow: false, box: true });
  shelfItem("trophy").forEach((trophy) => shelfShadow([trophy], 1, 0.8));
  shelfShadow([runtime.shelfConsole.ps5], 2, 0.8, { box: true });
  shelfShadow([runtime.shelfConsole.holder], 2, 0.7, { follow: false });
  shelfShadow([runtime.gauntlet.gauntlet], 3, 0.8);
  shelfItem("switch").forEach((handheld) => shelfShadow([handheld], 3, 0.7, { box: true }));
  wallShadow(runtime.wallDecor.clock, "back", 0.7, { box: false });
  wallShadow(runtime.wallDecor.paintingHang, "back", 0.7);
  wallShadow(runtime.aboutBoard.aboutBoard, "back", 0.6);
  wallShadow(runtime.guitar.guitar, "side", 0.7, { box: false, swing: runtime.guitar.guitarSwing });
  wallShadow(runtime.strawHat.hatPeg, "side", 0.6, { box: false });

  // Public state used by the other scene parts.
  return {
    contactShadows,
    updateContactShadows,
    mug,
    coaster,
    MUG_Y,
    updateSteam,
  };
}
