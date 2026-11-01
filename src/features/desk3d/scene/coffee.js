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
  const coasterRing = new THREE.Mesh(runtime.core.track(new THREE.TorusGeometry(0.6, 0.02, 6, 40)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#6e4520" })));
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
  const CONTACT_MAX = 32;
  const contactGeometry = runtime.core.track(new THREE.PlaneGeometry(1, 1));
  const contactAlpha = new THREE.InstancedBufferAttribute(new Float32Array(CONTACT_MAX), 1).setUsage(THREE.DynamicDrawUsage);
  const contactBox = new THREE.InstancedBufferAttribute(new Float32Array(CONTACT_MAX), 1);
  contactGeometry.setAttribute("contactAlpha", contactAlpha);
  contactGeometry.setAttribute("contactBox", contactBox);
  const contactMaterial = runtime.core.track(new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
    vertexShader: `
      attribute float contactAlpha;
      attribute float contactBox;
      varying vec2 vPlace;
      varying float vAlpha;
      varying float vBox;
      void main() {
        vPlace = uv * 2.0 - 1.0;
        vAlpha = contactAlpha;
        vBox = contactBox;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying vec2 vPlace;
      varying float vAlpha;
      varying float vBox;
      void main() {
        vec2 p = abs(vPlace);
        // 0 at the centre, 1 at the rim: an oval, or a box whose flat core spans 35% of it
        float d = mix(length(p), length(max(p - 0.35, 0.0)) / 0.65, vBox);
        // Eased at both ends, so there's no point at an oval's centre, no crease where a box's
        // flat core gives way, and no edge at the rim
        float shade = pow(1.0 - smoothstep(0.0, 1.0, d), 1.5);
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
    contactShadows.push({ size: 1, ...entry });
    contactDecals.count = contactShadows.length;
  };
  // Under a prop, on the surface it stands on. `anchor` offsets it from the prop's origin when
  // that isn't over its foot. Lifted props get a wider, fainter footprint.
  const contactShadow = (object, width, depth, surfaceY = 0, strength = 1, { box = false, anchor = null } = {}) =>
    addContact({ object, width, depth, surfaceY, strength, box, anchor, baseY: object.position.y });
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
  // Behind something hung on the back or side wall. `swing` is the part of it that sways, which
  // the shadow follows.
  const wallShadow = (object, wall, strength, { box = true, swing = object } = {}) => {
    const { centre, size } = boundsOf(object);
    swing.updateWorldMatrix(true, false);
    addContact({ object, wall, strength, box, swing, centre: swing.worldToLocal(centre), width: (wall === "side" ? size.z : size.x) * 1.1, depth: size.y * 1.1 });
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
  const SIDE_WALL_TURN = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  const NO_TURN = new THREE.Quaternion();
  function updateContactShadows() {
    const beam = runtime.windowLighting.windowLight;
    const night = runtime.core.roomLight.night;
    // A contact shadow is its own element, drawn bold enough to read as the prop resting on
    // the surface (as cel animation does: Petrovic et al. 2000), as dark as 40% at its core,
    // fainter by night and under cloud, where the light is flatter
    const contact = THREE.MathUtils.lerp(0.42, 0.32, night) * (1 - 0.2 * runtime.room.outside.rain);
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
      if (!object.visible || entry.size < 0.002) {
        contactDecals.setMatrixAt(i, contactMatrix.makeScale(0, 0, 0));
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
        contactAlpha.setX(i, contact * entry.strength * (0.85 + 0.3 * lean.weight));
        return;
      }
      const lift = Math.max(0, object.position.y - entry.baseY);
      // The window's sun reaches the desktop, not the floor under it. A high sun keeps the
      // footprint tight and dark; a low one draws it out, away from the window.
      const lit = entry.surfaceY > runtime.room.FLOOR_Y + 1 ? direct : 0;
      const footX = object.position.x + (entry.anchor?.x ?? 0);
      const footZ = object.position.z + (entry.anchor?.z ?? 0);
      const lean = leanFrom(footX, footZ);
      const leanBy = lean.weight * 0.18 * (entry.width + entry.depth) / 2;
      const pull = lit * 0.07 * reach * (entry.width + entry.depth) / 2;
      // drawn out along where it falls: by the key's lean, and further by a low sun on the desk
      const towardX = fallX * pull + lean.x * leanBy;
      const towardZ = fallZ * pull + lean.z * leanBy;
      const toward = Math.hypot(towardX, towardZ) || 1;
      const alongX = towardX / toward;
      const alongZ = towardZ / toward;
      const stretch = lit * 0.15 * (reach - 1) + 0.3 * lean.weight;
      contactTurn.setFromEuler(contactEuler.set(-Math.PI / 2, 0, -object.rotation.y));
      const spread = (1 + lift * 0.3) * entry.size;
      contactMatrix.compose(contactPlace.set(0, 0, 0), contactTurn, contactScale.set(entry.width * spread, entry.depth * spread, 1));
      contactStretch.set(
        1 + stretch * alongX * alongX, 0, stretch * alongX * alongZ, 0,
        0, 1, 0, 0,
        stretch * alongX * alongZ, 0, 1 + stretch * alongZ * alongZ, 0,
        0, 0, 0, 1,
      );
      contactMatrix.premultiply(contactStretch).setPosition(footX + towardX, entry.surfaceY + 0.008, footZ + towardZ);
      contactDecals.setMatrixAt(i, contactMatrix);
      contactAlpha.setX(i, contact * entry.strength * (0.85 + 0.3 * lean.weight) * (1 + lit * 0.45 / reach) / (1 + lift * 3));
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
  contactShadow(runtime.tickets.tickets, 3.4, 1.8, 0, 0.6);
  contactShadow(runtime.projectFiles.folders, runtime.projectFiles.FOLDER_W * 1.35, runtime.projectFiles.FOLDER_D * 1.35, 0, 0.7);
  contactShadow(runtime.postcard.mail, 3.0, 2.1, 0, 0.55);
  contactShadow(runtime.chair.chair, 7.2, 7.2, runtime.room.FLOOR_Y + 0.08, 0.8);
  contactShadow(runtime.lamp.lamp, 1.6, 1.6, 0, 0.8, { anchor: runtime.lamp.LAMP_BASE });
  contactShadow(runtime.lamp.familyFrame, 1.5, 0.9, 0, 0.6, { box: true });
  runtime.workstation.speakers.forEach(({ group }) => contactShadow(group, 1.9, 2.4, runtime.workstation.RISER_TOP, 0.7, { box: true }));
  floorShadow(runtime.shelf.shelf, 0.8, { box: true, pad: 1.1 });
  floorShadow(runtime.catTree.tree, 0.8, { box: true });
  floorShadow(runtime.gym.gym, 0.7);
  floorShadow(runtime.wastebasket.bin, 0.8);
  wallShadow(runtime.wallDecor.clock, "back", 0.7, { box: false });
  wallShadow(runtime.wallDecor.paintingHang, "back", 0.7);
  wallShadow(runtime.aboutBoard.aboutBoard, "back", 0.6);
  wallShadow(runtime.swordRack.katanaRack, "back", 0.6);
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
