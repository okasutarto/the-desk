import * as THREE from "three";
import gsap from "gsap";
import { sfx } from "@/shared/composables/useSfx";
import { canvasTexture, drawSparkStreak, drawBlackBolt, drawGlint, drawHakiAura, drawShout, drawSakuraPetal, drawSakuraBlossom, drawSwordCard } from "../textures";

export function createSwordEffects(runtime) {
  const glintTex = canvasTexture(128, 128);
  runtime.core.track(glintTex.texture);
  drawGlint(glintTex.ctx, 128, 128);
  const glint = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map: glintTex.texture, depthTest: false, transparent: true, blending: THREE.AdditiveBlending })));
  glint.renderOrder = 12;
  glint.raycast = runtime.core.noRaycast;
  glint.visible = false;
  runtime.core.scene.add(glint);
  // Enma's Haki aura, wrapped along the blade while it's out (one, moved to whichever is drawn)
  const auraTex = canvasTexture(256, 128);
  runtime.core.track(auraTex.texture);
  drawHakiAura(auraTex.ctx, 256, 128);
  const haki = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(1, 1)), runtime.core.track(new THREE.MeshBasicMaterial({ map: auraTex.texture, transparent: true, depthWrite: false, side: THREE.DoubleSide, opacity: 0 })));
  haki.raycast = runtime.core.noRaycast;
  haki.renderOrder = 11;
  haki.visible = false;
  // Kept a touch under full strength and height, so the blade still reads through it
  const HAKI_PEAK = 0.7;
  const HAKI_HEIGHT = 0.85;
  // Hovered, Enma leaks a little of its Haki: a faint aura breathing round the bare steel
  // between the guard and the saya's mouth as it slides part way out, gone again when the
  // pointer leaves (a strike takes over from there)
  const HOVER_BARE = 0.62;
  function hoverHaki(sword, on) {
    gsap.killTweensOf([haki.material, haki.scale]);
    if (!on) {
      gsap.to(haki.material, { opacity: 0, duration: 0.3, ease: "sine.in", onComplete: () => (haki.visible = false) });
      return;
    }
    sword.bladeGroup.add(haki);
    haki.position.set(HOVER_BARE / 2, runtime.swordRack.bow(HOVER_BARE / 2) + 0.01, 0);
    haki.scale.set(HOVER_BARE * 1.6, 0.6 * HAKI_HEIGHT, 1);
    haki.visible = true;
    // in as the blade comes out of the mouth, then breathing
    gsap.fromTo(haki.material, { opacity: 0 }, { opacity: HAKI_PEAK, duration: 0.4, delay: 0.3, ease: "sine.out" });
    gsap.to(haki.scale, { y: 0.78 * HAKI_HEIGHT, duration: 0.8, yoyo: true, repeat: -1, ease: "sine.inOut", delay: 0.3 });
  }
  const tipAt = new THREE.Vector3();
  const shoutTex = canvasTexture(640, 320);
  runtime.core.track(shoutTex.texture);
  const shout = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map: shoutTex.texture, depthTest: false, transparent: true })));
  shout.renderOrder = 12;
  shout.raycast = runtime.core.noRaycast;
  shout.scale.set(0.001, 0.001, 1);
  runtime.core.scene.add(shout);

  // Loose sakura petals, with a whole blossom every fourth one
  const petalTex = canvasTexture(128, 128);
  runtime.core.track(petalTex.texture);
  drawSakuraPetal(petalTex.ctx, 128, 128);
  const blossomTex = canvasTexture(160, 160);
  runtime.core.track(blossomTex.texture);
  drawSakuraBlossom(blossomTex.ctx, 160, 160);
  const petals = Array.from({ length: 12 }, (_, i) => {
    const petal = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map: i % 4 === 3 ? blossomTex.texture : petalTex.texture, transparent: true, depthWrite: false })));
    petal.userData.blossom = i % 4 === 3;
    // over the close-up's spotlight shadow (see spotlight), as the cut's other effects are
    petal.renderOrder = 11;
    petal.visible = false;
    petal.raycast = runtime.core.noRaycast;
    runtime.core.scene.add(petal);
    return petal;
  });

  // Each sword leaves its own mark: Wado its sakura (above); Sandai Kitetsu, the cursed blade,
  // throws a few crimson sparks off the cut; Enma cracks black lightning.
  const SPARK_COLORS = { kitetsu: { spark: "#e11d48", sparkCore: "#ffdd00" } };
  const sparkTex = Object.fromEntries(Object.entries(SPARK_COLORS).map(([style, { spark, sparkCore }]) => {
    const tex = canvasTexture(128, 32);
    runtime.core.track(tex.texture);
    drawSparkStreak(tex.ctx, 128, 32, { color: spark, core: sparkCore });
    return [style, tex.texture];
  }));

  // Sparks share a pool of sprites. Each is posed every frame by updateFx from its own age, by
  // its own little rule, until its life is up.
  const fxPool = [];
  const liveFx = [];
  function spawnFx({ map, life, delay = 0, order = 13, step }) {
    let sprite = fxPool.pop();
    if (!sprite) {
      sprite = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false })));
      sprite.raycast = runtime.core.noRaycast;
      runtime.core.scene.add(sprite);
    }
    sprite.material.map = map;
    sprite.material.opacity = 1;
    sprite.material.rotation = 0;
    sprite.renderOrder = order;
    sprite.visible = false;
    liveFx.push({ sprite, life, age: -delay, step });
  }
  function updateFx(dt) {
    for (let i = liveFx.length - 1; i >= 0; i--) {
      const fx = liveFx[i];
      fx.age += dt;
      if (fx.age < 0) continue;
      if (fx.age >= fx.life) {
        fx.sprite.visible = false;
        fxPool.push(fx.sprite);
        liveFx.splice(i, 1);
        continue;
      }
      fx.sprite.visible = true;
      fx.step(fx, fx.age / fx.life);
    }
  }
  // The arc the blade really cut through, kept from the smear as it lands (see markCut): where
  // its tip and the inner end of the smear were, from the wind-up to the hit, with how far
  // along the tip's path each was. A point on it: t runs from the wind-up end to the hit,
  // `inset` from the inner end (0) to the tip (1).
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const cutPath = [];
  function alongCut(t, inset = 0.9) {
    camRight.set(1, 0, 0).applyQuaternion(runtime.core.camera.quaternion);
    camUp.set(0, 1, 0).applyQuaternion(runtime.core.camera.quaternion);
    if (!cutPath.length) return new THREE.Vector3();
    const want = t * cutPath[cutPath.length - 1].at;
    let i = 1;
    while (i < cutPath.length - 1 && cutPath[i].at < want) i++;
    const a = cutPath[i - 1] || cutPath[0];
    const b = cutPath[i] || a;
    const k = b.at > a.at ? (want - a.at) / (b.at - a.at) : 0;
    const base = a.base.clone().lerp(b.base, k);
    return a.tip.clone().lerp(b.tip, k).sub(base).multiplyScalar(inset).add(base);
  }

  // Sparks flung out and up from a point, slowing in the air and falling: each a streak
  // pointing the way it flies, stretched by its speed
  const SPARK_DRAG = 2.4;
  const SPARK_G = -12;
  function sparkBurst(style, at, count, { delay = 0 } = {}) {
    for (let i = 0; i < count; i++) {
      const angle = Math.PI * (0.08 + Math.random() * 0.84);
      const speed = 4.5 + Math.random() * 4.5;
      const vx = Math.cos(angle) * speed;
      const vy0 = Math.sin(angle) * speed;
      const terminal = SPARK_G / SPARK_DRAG;
      spawnFx({
        map: sparkTex[style],
        life: 0.5 + Math.random() * 0.4,
        delay: delay + Math.random() * 0.06,
        step: (fx, t) => {
          // in closed form, so a slow frame never throws one off course
          const fade = Math.exp(-SPARK_DRAG * fx.age);
          const k = (1 - fade) / SPARK_DRAG;
          const vxNow = vx * fade;
          const vyNow = terminal + (vy0 - terminal) * fade;
          const shrink = t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
          fx.sprite.center.set(0.85, 0.5);
          fx.sprite.scale.set((0.25 + Math.hypot(vxNow, vyNow) * 0.08) * shrink, 0.15 * shrink, 1);
          fx.sprite.position.copy(at).addScaledVector(camRight, vx * k).addScaledVector(camUp, terminal * fx.age + (vy0 - terminal) * k);
          fx.sprite.material.rotation = Math.atan2(vyNow, vxNow);
        },
      });
    }
  }
  const boltTex = canvasTexture(128, 256);
  runtime.core.track(boltTex.texture);
  drawBlackBolt(boltTex.ctx, 128, 256);
  const bolts = Array.from({ length: 3 }, () => {
    const bolt = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map: boltTex.texture, transparent: true, depthTest: false, depthWrite: false })));
    bolt.visible = false;
    bolt.raycast = runtime.core.noRaycast;
    bolt.renderOrder = 13;
    runtime.core.scene.add(bolt);
    return bolt;
  });
  function sakuraFall() {
    petals.forEach((petal, i) => {
      gsap.killTweensOf([petal.position, petal.material]);
      petal.visible = true;
      // petals tumble: their width flips back and forth as they turn over in the air
      const size = (petal.userData.blossom ? 0.34 : 0.26) + Math.random() * 0.1;
      petal.scale.set(size, size, 1);
      gsap.killTweensOf(petal.scale);
      if (!petal.userData.blossom) gsap.to(petal.scale, { x: size * 0.25, duration: 0.35 + Math.random() * 0.3, yoyo: true, repeat: 9, ease: "sine.inOut", delay: i * 0.03 });
      petal.material.opacity = 1;
      const x = katanaWorld.x - 2.5 + Math.random() * 4;
      const z = katanaWorld.z + 0.1 + Math.random() * 0.4;
      petal.position.set(x, katanaWorld.y + 1.2 + Math.random() * 1.6, z);
      const fall = 2.2 + Math.random() * 1.2;
      gsap.to(petal.position, { y: katanaWorld.y - 2.6 - Math.random(), x: x + 0.6 + Math.random() * 0.8, duration: fall, delay: i * 0.03, ease: "sine.in" });
      gsap.fromTo(petal.material, { rotation: Math.random() * 3 }, { rotation: `+=${4 + Math.random() * 4}`, duration: fall, delay: i * 0.03 });
      gsap.to(petal.material, { opacity: 0, delay: fall - 0.4 + i * 0.03, duration: 0.4, onComplete: () => (petal.visible = false) });
    });
  }
  // Sandai Kitetsu: sparks thrown off the cut, from two points along it
  function cursedSparks() {
    sparkBurst("kitetsu", alongCut(0.6), 7);
    sparkBurst("kitetsu", alongCut(0.95), 7, { delay: 0.04 });
  }
  // Enma: black lightning cracking down off the cut in three places, one after another, each
  // flickering (on, off, on again) the way lightning does
  function enmaLightning() {
    bolts.forEach((bolt, i) => {
      gsap.killTweensOf(bolt.material);
      // hanging from the arc the tip swept, down past it
      const size = 1.8 + Math.random() * 0.6;
      bolt.position.copy(alongCut(0.35 + i * 0.3, 1)).addScaledVector(camUp, -size * 0.3);
      bolt.scale.set(size * 0.5, size, 1);
      bolt.material.rotation = (Math.random() - 0.5) * 0.7;
      bolt.material.opacity = 0;
      bolt.visible = true;
      gsap.timeline({ delay: i * 0.05, onComplete: () => (bolt.visible = false) })
        .set(bolt.material, { opacity: 1 })
        .set(bolt.material, { opacity: 0 }, 0.05)
        .set(bolt.material, { opacity: 1 }, 0.09)
        .set(bolt.material, { opacity: 0 }, 0.22);
    });
    sfx.thunder();
  }

  const TECHNIQUES = [
    "SHISHI SONSON!", "36 POUND CANNON!", "DAI SHINKAN!", "ONI GIRI!", "TATSU MAKI!", "SANZEN SEKAI!",
    "YAKKODORI!", "HIRYU KAEN!", "RENGOKU ONI GIRI!", "ASURA: ICHIBUGIN!", "KOKUJO: O TATSUMAKI!",
    "ICHIDAI SANZEN DAISEN SEKAI!", "HYAKUHACHI POUND HO!", "ENMA: KING OF HELL!",
  ];
  let techniqueIndex = Math.floor(Math.random() * TECHNIQUES.length);
  const SHOUT_W = 5.85;
  const SHOUT_H = 2.925;
  const katanaWorld = new THREE.Vector3();
  let slashing = false;
  // the strike under way, and whether it's past the cut and only going home
  let activeSlash = null;
  let activeSword = null;
  let recovering = false;
  // The impact frame: for two or three frames as the blade bites, the picture inverts, the
  // way anime punctuates a hit. Left out for anyone who's asked for reduced motion.
  const impactFlash = document.createElement("div");
  Object.assign(impactFlash.style, {
    position: "absolute",
    inset: "0",
    background: "#fff",
    mixBlendMode: "difference",
    pointerEvents: "none",
    opacity: "0",
  });
  runtime.options.container.appendChild(impactFlash);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  function impactFrame() {
    if (reducedMotion.matches) return;
    impactFlash.style.opacity = "0.9";
    gsap.delayedCall(0.045, () => (impactFlash.style.opacity = "0"));
  }
  let shoutTimer = null;

  // Nudges a sprite of the given world size back inside the screen, below the page's top bar
  // (the 3D site's title and "Back to desk" buttons), wherever the camera and window size put it
  const TOP_BAR_PX = 80;
  const screenAxis = new THREE.Vector3();
  function keepOnScreen(sprite, w, h) {
    const centre = sprite.position.clone().project(runtime.core.camera);
    const upW = screenAxis.set(0, 1, 0).applyQuaternion(runtime.core.camera.quaternion).clone();
    const rightW = screenAxis.set(1, 0, 0).applyQuaternion(runtime.core.camera.quaternion).clone();
    const halfY = sprite.position.clone().addScaledVector(upW, h / 2).project(runtime.core.camera).y - centre.y;
    const halfX = sprite.position.clone().addScaledVector(rightW, w / 2).project(runtime.core.camera).x - centre.x;
    const top = 1 - (2 * TOP_BAR_PX) / (runtime.options.container.clientHeight || 1);
    let dy = 0;
    if (centre.y + halfY > top) dy = top - (centre.y + halfY);
    else if (centre.y - halfY < -0.95) dy = -0.95 - (centre.y - halfY);
    let dx = 0;
    if (centre.x + halfX > 0.96) dx = 0.96 - (centre.x + halfX);
    else if (centre.x - halfX < -0.96) dx = -0.96 - (centre.x - halfX);
    // back from screen units to world units along the camera's axes
    sprite.position.addScaledVector(upW, (dy * (h / 2)) / halfY).addScaledVector(rightW, (dx * (w / 2)) / halfX);
  }

  // The cut itself, as anime draws it: one smear, the strip of air the blade swept through,
  // locked to the blade at its front and tapering away behind to a hairline at the tip's edge.
  // It holds its whole body for a few frames, then is eaten away fast from the inside, raggedly,
  // rather than fading. Bold and flat: white over its outer half (the side the tip swept), the
  // sword's colour inside that, ink along the tip's edge and wherever it's eaten.
  const TRAIL_SAMPLES = 96;
  const TRAIL_LIFE = 0.2;
  const TRAIL_COLORS = { wado: "#bfe9ff", kitetsu: "#e11d48", enma: "#7e22ce" };
  const trailGeo = runtime.core.track(new THREE.BufferGeometry());
  trailGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(TRAIL_SAMPLES * 6), 3));
  trailGeo.setAttribute("age", new THREE.BufferAttribute(new Float32Array(TRAIL_SAMPLES * 2), 1));
  trailGeo.setAttribute("side", new THREE.BufferAttribute(new Float32Array(TRAIL_SAMPLES * 2), 1));
  trailGeo.setAttribute("born", new THREE.BufferAttribute(new Float32Array(TRAIL_SAMPLES * 2), 1));
  trailGeo.setAttribute("lead", new THREE.BufferAttribute(new Float32Array(TRAIL_SAMPLES * 2), 1));
  trailGeo.setIndex(Array.from({ length: TRAIL_SAMPLES - 1 }, (_, i) => [2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2]).flat());
  const trailColor = { value: new THREE.Color() };
  const trail = new THREE.Mesh(trailGeo, runtime.core.track(new THREE.ShaderMaterial({
    uniforms: { color: trailColor, ink: { value: new THREE.Color("#1a1714") } },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      attribute float age;
      attribute float side;
      attribute float born;
      attribute float lead;
      varying float vAge;
      varying float vSide;
      varying float vBorn;
      varying float vLead;
      void main() {
        vAge = age;
        vSide = side;
        vBorn = born;
        vLead = lead;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 color;
      uniform vec3 ink;
      varying float vAge;
      varying float vSide;
      varying float vBorn;
      varying float vLead;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      float noise(float x) {
        float i = floor(x);
        float f = fract(x);
        return mix(hash(i), hash(i + 1.0), f * f * (3.0 - 2.0 * f));
      }
      void main() {
        // eaten from the inside as it ages, slow then fast; the ragged edge is keyed to when
        // each stretch was laid down, so it stays put on the stroke rather than crawling
        float ragged = noise(vBorn * 90.0) - 0.5;
        float inner = smoothstep(0.3, 1.0, vAge) * 1.05 + ragged * 0.2 * vAge;
        // the stretch carried on past the blade narrows to a point on the tip's edge
        inner = max(inner, pow(vLead, 1.4));
        if (vSide < inner) discard;
        vec3 c = color;
        if (vSide > 0.965) c = ink;
        else if (vSide > 0.5) c = vec3(1.0);
        else if (vSide < inner + 0.045) c = ink;
        gl_FragColor = vec4(c, 1.0);
      }`,
  })));
  trail.raycast = runtime.core.noRaycast;
  trail.frustumCulled = false;
  trail.renderOrder = 12;
  trail.visible = false;
  runtime.core.scene.add(trail);
  const trailSamples = [];
  let trailSword = null;
  let trailClock = 0;
  // where the blade was last frame: its hand, and the inner and outer ends of the smear
  const trailLast = { hand: new THREE.Vector3(), base: new THREE.Vector3(), tip: new THREE.Vector3(), at: 0, set: false };
  const trailNow = { hand: new THREE.Vector3(), base: new THREE.Vector3(), tip: new THREE.Vector3() };
  function startTrail(sword) {
    trailSword = sword;
    trailSamples.length = 0;
    trailLast.set = false;
    trailColor.value.set(TRAIL_COLORS[sword.style]);
  }
  function stopTrail() {
    trailSword = null;
  }
  // As the blade lands the smear stops following it and carries on round a little way past it,
  // along the circle the tip was swinging through, about the hand, narrowing to a point: the
  // way anime draws a cut, its arc running out just ahead of the blade.
  const CUT_CARRY = 0.3;
  const CARRY_STEPS = 6;
  const carryAxis = new THREE.Vector3();
  const carryTurn = new THREE.Quaternion();
  const carryArm = new THREE.Vector3();
  function extendCut() {
    const sword = trailSword;
    stopTrail();
    if (!sword || !trailSamples.length) return;
    const blade = sword.bladeGroup;
    blade.localToWorld(trailNow.hand.set(-runtime.swords.TSUKA_L / 2, 0, 0));
    blade.localToWorld(trailNow.base.set(runtime.swordRack.BLADE_L * 0.3, runtime.swordRack.bow(runtime.swordRack.BLADE_L * 0.3), 0));
    blade.localToWorld(trailNow.tip.set(runtime.swordRack.BLADE_L + 0.12, runtime.swordRack.bow(runtime.swordRack.BLADE_L + 0.12) + 0.02, 0));
    // the plane of the swing: round the hand, from where the tip was a little way back to now
    const back = trailSamples.find((sample) => sample.tip.distanceTo(trailNow.tip) > 0.3);
    if (!back) return;
    carryAxis.subVectors(back.tip, trailNow.hand).cross(carryArm.subVectors(trailNow.tip, trailNow.hand)).normalize();
    for (let step = 0; step <= CARRY_STEPS; step++) {
      const k = step / CARRY_STEPS;
      carryTurn.setFromAxisAngle(carryAxis, CUT_CARRY * k);
      const sample = {
        base: carryArm.subVectors(trailNow.base, trailNow.hand).applyQuaternion(carryTurn).add(trailNow.hand).clone(),
        tip: carryArm.subVectors(trailNow.tip, trailNow.hand).applyQuaternion(carryTurn).add(trailNow.hand).clone(),
        at: trailClock,
        lead: k,
      };
      trailSamples.unshift(sample);
      if (trailSamples.length > TRAIL_SAMPLES) trailSamples.pop();
    }
  }
  // As the blade lands: keep the arc it cut (the smear so far, oldest first, the held wind-up
  // folded into one point) for the sparks thrown off it (alongCut)
  function markCut() {
    cutPath.length = 0;
    let at = 0;
    for (let i = trailSamples.length - 1; i >= 0; i--) {
      const sample = trailSamples[i];
      const last = cutPath[cutPath.length - 1];
      if (last) {
        const step = sample.tip.distanceTo(last.tip);
        if (step < 1e-4) continue;
        at += step;
      }
      cutPath.push({ base: sample.base.clone(), tip: sample.tip.clone(), at });
    }
  }
  const armFrom = new THREE.Vector3();
  const armTo = new THREE.Vector3();
  const armTurn = new THREE.Quaternion();
  const noTurn = new THREE.Quaternion();
  const armPart = new THREE.Quaternion();
  const handAt = new THREE.Vector3();
  // A point k of the way between last frame and this one, swung round the hand rather than
  // cut straight across, so a fast cut still sweeps a true arc
  function swungPoint(from, to, k, out) {
    armFrom.subVectors(from, trailLast.hand);
    armTo.subVectors(to, trailNow.hand);
    const fromLength = armFrom.length();
    const toLength = armTo.length();
    armTurn.setFromUnitVectors(armFrom.normalize(), armTo.normalize());
    armPart.slerpQuaternions(noTurn, armTurn, k);
    return out.copy(armFrom).applyQuaternion(armPart).multiplyScalar(fromLength + (toLength - fromLength) * k)
      .add(handAt.lerpVectors(trailLast.hand, trailNow.hand, k));
  }
  const TRAIL_STEPS = 4;
  // Each frame: where the blade is (the outer half of it, out to the tip) while it's cutting,
  // with in-between samples back to last frame, and the strip rebuilt from the samples still
  // young enough to show
  function updateTrail(dt) {
    const before = trailClock;
    trailClock += dt;
    if (trailSword) {
      const blade = trailSword.bladeGroup;
      blade.localToWorld(trailNow.hand.set(-runtime.swords.TSUKA_L / 2, 0, 0));
      blade.localToWorld(trailNow.base.set(runtime.swordRack.BLADE_L * 0.3, runtime.swordRack.bow(runtime.swordRack.BLADE_L * 0.3), 0));
      blade.localToWorld(trailNow.tip.set(runtime.swordRack.BLADE_L + 0.12, runtime.swordRack.bow(runtime.swordRack.BLADE_L + 0.12) + 0.02, 0));
      for (let step = trailLast.set ? 1 : TRAIL_STEPS; step <= TRAIL_STEPS; step++) {
        const k = step / TRAIL_STEPS;
        const sample = trailSamples.length >= TRAIL_SAMPLES ? trailSamples.pop() : { base: new THREE.Vector3(), tip: new THREE.Vector3() };
        if (k < 1) {
          swungPoint(trailLast.base, trailNow.base, k, sample.base);
          swungPoint(trailLast.tip, trailNow.tip, k, sample.tip);
        } else {
          sample.base.copy(trailNow.base);
          sample.tip.copy(trailNow.tip);
        }
        sample.at = before + dt * k;
        sample.lead = 0;
        trailSamples.unshift(sample);
      }
      trailLast.hand.copy(trailNow.hand);
      trailLast.base.copy(trailNow.base);
      trailLast.tip.copy(trailNow.tip);
      trailLast.set = true;
    }
    while (trailSamples.length && trailClock - trailSamples[trailSamples.length - 1].at > TRAIL_LIFE) trailSamples.pop();
    trail.visible = trailSamples.length > 1;
    if (!trail.visible) return;
    const pos = trailGeo.attributes.position;
    const age = trailGeo.attributes.age;
    const side = trailGeo.attributes.side;
    const born = trailGeo.attributes.born;
    const lead = trailGeo.attributes.lead;
    for (let i = 0; i < TRAIL_SAMPLES; i++) {
      // past the samples there are, repeat the oldest: those triangles are empty
      const s = trailSamples[Math.min(i, trailSamples.length - 1)];
      const a = Math.min(1, (trailClock - s.at) / TRAIL_LIFE);
      pos.setXYZ(2 * i, s.base.x, s.base.y, s.base.z);
      pos.setXYZ(2 * i + 1, s.tip.x, s.tip.y, s.tip.z);
      age.setX(2 * i, a);
      age.setX(2 * i + 1, a);
      side.setX(2 * i, 0);
      side.setX(2 * i + 1, 1);
      born.setX(2 * i, s.at);
      born.setX(2 * i + 1, s.at);
      lead.setX(2 * i, s.lead);
      lead.setX(2 * i + 1, s.lead);
    }
    pos.needsUpdate = true;
    age.needsUpdate = true;
    side.needsUpdate = true;
    born.needsUpdate = true;
    lead.needsUpdate = true;
  }

  function tossKitetsu(sword, restY) {
    if (slashing) return;
    slashing = true;
    const g = sword.tierGroup;
    gsap.killTweensOf([g.position, g.rotation]);
    sfx.whoosh({ duration: 0.4 });
    gsap.timeline({ onComplete: () => (slashing = false) })
      .to(g.position, { y: restY + 2.4, z: 0.6, duration: 0.55, ease: "power2.out" })
      .to(g.rotation, { z: Math.PI * 4, duration: 1.1, ease: "none" }, 0)
      .to(g.position, { y: restY, z: 0.2, duration: 0.55, ease: "power2.in" }, 0.55)
      .set(g.rotation, { z: 0 })
      .call(() => {
        sfx.rackLand({ strength: 0.8 });
        runtime.swordRack.kickTassels(sword.sayaGroup, 1);
        g.getWorldPosition(katanaWorld);
        drawShout(shoutTex.ctx, 640, 320, "THE CURSE LIKES ME!", { style: "kitetsu" });
        shoutTex.texture.needsUpdate = true;
        shout.position.set(katanaWorld.x - 3.1, katanaWorld.y + 1.95, katanaWorld.z + 0.25);
        keepOnScreen(shout, SHOUT_W, SHOUT_H);
        gsap.fromTo(shout.scale, { x: 1, y: 0.5 }, { x: SHOUT_W, y: SHOUT_H, duration: 0.3, ease: "back.out(3)", overwrite: true });
        clearTimeout(shoutTimer);
        shoutTimer = setTimeout(() => gsap.to(shout.scale, { x: 0.001, y: 0.001, duration: 0.2, ease: "power2.in", overwrite: true }), 2000);
      })
      .fromTo(g.position, { y: restY + 0.06 }, { y: restY, duration: 0.3, ease: "bounce.out" });
  }
  // Something to do once the strike under way is home (a toss asked for mid-strike): it's held
  // on the striking sword and runs as that one is sheathed. With no strike going (a toss still
  // in the air) it's dropped, so it can't wait around and fire after some later strike.
  function afterStrike(fn) {
    if (slashing && activeSlash?.isActive()) activeSword.afterSlash = fn;
  }
  function slashSword(sword) {
    if (slashing) {
      // Clicked again while the last blade is only going home: it hurries back, and this one
      // goes as soon as it's in
      if (recovering) {
        activeSlash.timeScale(3);
        afterStrike(() => slashSword(sword));
      }
      return;
    }
    slashing = true;
    sword.afterSlash = null;
    runtime.secrets.discover("katana");
    const technique = TECHNIQUES[techniqueIndex++ % TECHNIQUES.length];
    const out = runtime.swordRack.drawTurn(runtime.swordRack.BLADE_L + 0.25);
    const home = -runtime.swordRack.SORI_R;
    // the hand just high enough that the blade, swung down to level and a little past it, still
    // clears the top sword whichever tier this one hangs on (and the raised tip stays in frame)
    const aboveRack = runtime.swordRack.RACK_TIERS[0] + 0.62 - sword.yRack;
    gsap.killTweensOf([sword.drawPivot.rotation, sword.bladeGroup.position, sword.bladeGroup.rotation]);
    // the saya stays up off its hooks, where the hover lifts it, while the blade is out; it's
    // set back down only once the blade is home (at the sheathe, below)
    gsap.to(sword.tierGroup.position, { y: sword.restY + 0.22, z: 0.5, duration: 0.2, overwrite: true });
    gsap.to(sword.tierGroup.rotation, { z: 0.035, duration: 0.2, overwrite: true });
    runtime.swordRack.glintBlade(0.3);
    if (sword.style === "enma") {
      // the aura rises off the blade as it's drawn, flickering, and fades as it's sheathed
      sword.bladeGroup.add(haki);
      haki.position.set(runtime.swordRack.BLADE_L / 2 + 0.05, runtime.swordRack.bow(runtime.swordRack.BLADE_L / 2) + 0.02, 0);
      haki.scale.set(runtime.swordRack.BLADE_L * 1.35, 0.75 * HAKI_HEIGHT, 1);
      haki.visible = true;
      // it swells in, then breathes slowly while the sword is out
      gsap.killTweensOf([haki.material, haki.scale]);
      gsap.fromTo(haki.material, { opacity: 0 }, { opacity: HAKI_PEAK, duration: 0.7, delay: 0.2, ease: "sine.out" });
      gsap.fromTo(haki.scale, { y: 0.55 * HAKI_HEIGHT }, { y: 0.95 * HAKI_HEIGHT, duration: 0.7, delay: 0.2, ease: "sine.out" });
      gsap.to(haki.scale, { y: 0.8 * HAKI_HEIGHT, x: runtime.swordRack.BLADE_L * 1.28, duration: 0.65, yoyo: true, repeat: 3, ease: "sine.inOut", delay: 0.9 });
    }
    // Drawn along the saya's curve, swung free of it, then slid back in along the same curve
    const tl = gsap.timeline({
      onComplete: () => {
        slashing = false;
        recovering = false;
        // a toss asked for mid-strike goes once the blade is home
        const next = sword.afterSlash;
        sword.afterSlash = null;
        if (next) next();
      },
    });
    activeSlash = tl;
    activeSword = sword;
    if (sword.style === "kitetsu") {
      // the cursed blade stirs first: it shudders in the rack and growls, wanting to cut
      const x = sword.tierGroup.position.x;
      sfx.growl({ duration: 0.4 });
      tl.fromTo(sword.tierGroup.position, { x: x - 0.018 }, { x: x + 0.018, duration: 0.035, repeat: 5, yoyo: true, ease: "none" })
        .set(sword.tierGroup.position, { x });
    }
    tl
      .call(() => {
        sword.steel.visible = true;
        sfx.shing();
        runtime.swordRack.kickTassels(sword.sayaGroup, 1);
      })
      .to(sword.drawPivot.rotation, { z: out, duration: 0.42, ease: "power2.in" })
      // Up past the handle end and over above the whole rack in one curve (rising fast while
      // it's slow to move over), never passing across a saya
      .to(sword.bladeGroup.position, { y: home + aboveRack, duration: 0.38, ease: "power3.out" })
      .to(sword.bladeGroup.position, { z: -0.7, duration: 0.2, ease: "power2.out" }, "<")
      .to(sword.bladeGroup.position, { x: 2.1, duration: 0.38, ease: "power2.in" }, "<")
      .to(sword.bladeGroup.rotation, { z: 0.55, duration: 0.3, ease: "power2.inOut" }, "<0.08")
      // Wind-up: cocked back over the rack (not so high the tip leaves the frame), settling
      // into a held beat long enough to read
      .to(sword.bladeGroup.rotation, { z: 0.95, duration: 0.28, ease: "power3.out" })
      .to(sword.bladeGroup.position, { x: 1.8, duration: 0.28, ease: "power3.out" }, "<")
      .call(() => startTrail(sword))
      .to({}, { duration: 0.1 })
      // The cut: all at once, seven frames or so, one sweep from high over the rack right down
      // past level to low in front of it (passing in front of the other swords), the hand
      // carried along with it on the same curve
      .to(sword.bladeGroup.rotation, { z: -0.8, duration: 0.12, ease: "power3.in" })
      .to(sword.bladeGroup.position, { x: 2.75, y: "-=0.12", duration: 0.12, ease: "power3.in" }, "<")
      // The hit, staggered as anime times it: the impact frame and the jolt on the hit itself,
      // the sword's own mark a few frames on, then the technique's name
      .addLabel("hit")
      .call(() => {
        sword.bladeGroup.getWorldPosition(katanaWorld);
        extendCut();
        markCut();
        impactFrame();
        sfx.slash();
        if (sword.style === "wado") {
          // light catching the tip as it cuts
          sword.bladeGroup.localToWorld(tipAt.set(runtime.swordRack.BLADE_L + 0.12, runtime.swordRack.bow(runtime.swordRack.BLADE_L + 0.12) + 0.02, 0));
          glint.position.copy(tipAt);
          glint.visible = true;
          gsap.fromTo(glint.scale, { x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9, duration: 0.14, yoyo: true, repeat: 1, ease: "power2.out", onComplete: () => (glint.visible = false) });
          gsap.fromTo(glint.material, { rotation: 0 }, { rotation: 0.8, duration: 0.28 });
        }
        // The hit jolts the camera, hard at first and settling fast; Enma's Haki a little harder
        const tx = runtime.camera.cam.tx;
        const ty = runtime.camera.cam.ty;
        const kick = sword.style === "enma" ? 0.08 : 0.05;
        const shake = gsap.timeline();
        [1, -0.6, 0.3, -0.12].forEach((k) => shake.to(runtime.camera.cam, { tx: tx + kick * k, ty: ty - kick * 0.6 * k, duration: 0.04, ease: "sine.inOut" }));
        shake.to(runtime.camera.cam, { tx, ty, duration: 0.05, ease: "sine.out" });
      })
      // Hit-stop: the blade holds dead still a beat as it bites, then settles the last of the way
      .to({}, { duration: 0.1 })
      .to(sword.bladeGroup.rotation, { z: -0.86, duration: 0.14, ease: "power3.out" })
      // Zanshin: held there, low, a long breath
      .to({}, { duration: 0.45 })
      // Chiburi: the blade lifted a little, then flicked down sharp to throw it clean
      .to(sword.bladeGroup.rotation, { z: -0.6, duration: 0.25, ease: "power2.inOut" })
      .to(sword.bladeGroup.rotation, { z: -0.92, duration: 0.08, ease: "power3.in" })
      .call(() => sfx.whoosh({ duration: 0.15, up: false }))
      .to(sword.bladeGroup.rotation, { z: -0.84, duration: 0.18, ease: "power2.out" })
      .to({}, { duration: 0.25 })
      // from here it's only going home, and a click hurries it (see the top)
      .call(() => (recovering = true))
      // Back the way it came, unhurried: raised level as it goes over to the handle end (in front
      // of the other swords), dropping once it's there, then in to the rack
      .to(sword.bladeGroup.rotation, { z: 0, duration: 0.75, ease: "power2.inOut" })
      .to(sword.bladeGroup.position, { x: 0, duration: 0.75, ease: "power2.inOut" }, "<")
      .to(sword.bladeGroup.position, { y: home, duration: 0.45, ease: "power2.in" }, "<0.4")
      .to(sword.bladeGroup.position, { z: 0, duration: 0.15, ease: "power2.in" })
      // Noto: slid home slowly most of the way, then the last of it snaps in with a click
      .to(sword.drawPivot.rotation, { z: out * 0.12, duration: 0.5, ease: "sine.inOut" })
      .to(sword.drawPivot.rotation, { z: 0, duration: 0.07, ease: "power4.in" })
      .call(() => {
        sfx.sheathe();
        runtime.swordRack.kickTassels(sword.sayaGroup, 0.8);
        sword.steel.visible = false;
        // sheathed: only now does the saya go back down onto its hooks, with a soft knock
        gsap.to(sword.tierGroup.position, { y: sword.restY, z: 0.2, duration: 0.35, delay: 0.15, ease: "power2.inOut", overwrite: true, onComplete: () => sfx.rackLand({ strength: 0.45 }) });
        gsap.to(sword.tierGroup.rotation, { z: 0, duration: 0.35, delay: 0.15, ease: "power2.out", overwrite: true });
        if (sword.style === "enma") gsap.to(haki.material, { opacity: 0, duration: 0.5, ease: "sine.in", onComplete: () => (haki.visible = false) });
      })
      .fromTo(runtime.swordRack.katanaRack.scale, { y: runtime.swordRack.KATANA_SCALE * 0.94 }, { y: runtime.swordRack.KATANA_SCALE, duration: 0.3, ease: "back.out(3)" })
      // (placed at the hit, after the rest is laid down, so they don't push it along)
      .call(() => {
        if (sword.style === "wado") sakuraFall();
        else if (sword.style === "kitetsu") cursedSparks();
        else enmaLightning();
      }, null, "hit+=0.05")
      .call(() => {
        drawShout(shoutTex.ctx, 640, 320, technique, { style: sword.style });
        shoutTex.texture.needsUpdate = true;
        // Close by the cut: up and a little to the left of the hand, over the top of the arc
        shout.position.set(katanaWorld.x - 3.1, katanaWorld.y + 2.45, katanaWorld.z + 0.25);
        keepOnScreen(shout, SHOUT_W, SHOUT_H);
        gsap.fromTo(shout.scale, { x: 1, y: 0.5 }, { x: SHOUT_W, y: SHOUT_H, duration: 0.3, ease: "back.out(3)", overwrite: true });
        gsap.fromTo(shout.material, { rotation: 0.15 }, { rotation: 0, duration: 0.5, ease: "elastic.out(1.2, 0.4)" });
        clearTimeout(shoutTimer);
        shoutTimer = setTimeout(() => gsap.to(shout.scale, { x: 0.001, y: 0.001, duration: 0.2, ease: "power2.in", overwrite: true }), 1600);
      }, null, "hit+=0.1");
  }

  // Common scabbard curve
  const sayaCurve = new THREE.CatmullRomCurve3(Array.from({ length: 9 }, (_, i) => {
    const x = 0.04 + (i / 8) * (runtime.swordRack.BLADE_L + 0.16);
    return new THREE.Vector3(x, runtime.swordRack.bow(x), 0);
  }));

  const hitAreaMat = runtime.core.track(new THREE.MeshBasicMaterial({ visible: false }));
  // The sword under the pointer, and a timer for its card once the camera has come in
  let swordZoomTimer = null;
  // The sword's card: a sprite beside the rack, level with the sword, always facing the camera
  const SWORD_CARD = { w: 4.8, h: 4.8 * (480 / 760) };
  const swordCardTex = canvasTexture(760, 480);
  runtime.core.track(swordCardTex.texture);
  const swordCard = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map: swordCardTex.texture, depthTest: false, transparent: true })));
  swordCard.renderOrder = 12;
  swordCard.raycast = runtime.core.noRaycast;
  swordCard.scale.set(0.001, 0.001, 1);
  runtime.core.scene.add(swordCard);
  const swordCardAt = new THREE.Vector3();
  function showSwordCard(sword) {
    drawSwordCard(swordCardTex.ctx, 760, 480, sword.info);
    swordCardTex.texture.needsUpdate = true;
    // Left of the rack, level with the sword
    runtime.swordRack.katanaRack.getWorldPosition(swordCardAt);
    sword.tierGroup.getWorldPosition(swordCard.position);
    // (the card's art starts at the top of its canvas, so the sprite's centre sits above the
    // sword's height to put the card itself a little above it, and a little clear to its left)
    swordCard.position.set(swordCardAt.x - (runtime.swords.SWORD_SPAN / 2) * runtime.swordRack.KATANA_SCALE - SWORD_CARD.w / 2 - 0.55, swordCard.position.y + 0.45, swordCardAt.z + 0.8);
    gsap.fromTo(swordCard.scale, { x: SWORD_CARD.w * 0.85, y: SWORD_CARD.h * 0.85 }, { x: SWORD_CARD.w, y: SWORD_CARD.h, duration: 0.3, ease: "back.out(2)", overwrite: true });
  }
  function hideSwordCard() {
    gsap.to(swordCard.scale, { x: 0.001, y: 0.001, duration: 0.15, ease: "power2.in", overwrite: true });
  }
  // The rack's close-up has a spotlight on it: everything round the strike's space (the cork
  // board, the gauntlet, the desk) sinks into shadow as the camera comes in, so the eye stays on
  // the swords. One screen-filling layer of ink with a soft oval hole over the rack and the air
  // the strike sweeps through (high above it for the wind-up, low under it for the finish: so
  // taller than it is wide), drawn after the room but before the cards, plates and the cut's
  // effects, which stay bright.
  // In world units, sized to the full-size swords (about 90 cm, 9 units, across)
  const SPOT_REACH = { x: 6.0, y: 8.0 };
  // The sword key's own strength at midday, and how much of the room's lost fill (morning,
  // evening, night, rain) it makes up on top
  const SWORD_KEY = 0.3;
  const SWORD_FILL_MAKEUP = 1;
  // A dedicated key keeps the swords lit through every room phase; the overlay only
  // darkens their surroundings. Fade with focus, independently of the room lights.
  const swordSpotlight = new THREE.SpotLight("#fff4e8", 0, 32, Math.PI / 4, 0.65, 0);
  swordSpotlight.castShadow = true;
  swordSpotlight.shadow.mapSize.set(1024, 1024);
  swordSpotlight.shadow.camera.near = 0.5;
  swordSpotlight.shadow.camera.far = 32;
  swordSpotlight.shadow.bias = -0.0002;
  swordSpotlight.shadow.normalBias = 0.015;
  swordSpotlight.shadow.radius = 2;
  swordSpotlight.shadow.autoUpdate = false;
  runtime.core.scene.add(swordSpotlight, swordSpotlight.target);
  const spotUniforms = {
    center: { value: new THREE.Vector2() },
    radius: { value: new THREE.Vector2(1, 1) },
    strength: { value: 0 },
    ink: { value: new THREE.Color("#1a1714") },
  };
  const spotlight = new THREE.Mesh(runtime.core.track(new THREE.PlaneGeometry(2, 2)), runtime.core.track(new THREE.ShaderMaterial({
    uniforms: spotUniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vNdc;
      void main() {
        vNdc = position.xy;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }`,
    fragmentShader: `
      uniform vec2 center;
      uniform vec2 radius;
      uniform float strength;
      uniform vec3 ink;
      varying vec2 vNdc;
      void main() {
        float d = length((vNdc - center) / radius);
        gl_FragColor = vec4(ink, strength * 0.7 * smoothstep(0.75, 1.15, d));
      }`,
  })));
  spotlight.frustumCulled = false;
  spotlight.raycast = runtime.core.noRaycast;
  spotlight.renderOrder = 10;
  spotlight.visible = false;
  runtime.core.scene.add(spotlight);
  const spotAt = new THREE.Vector3();
  const spotEdge = new THREE.Vector3();
  // The monitor, gauntlet and handheld step aside for the sword close-up. Only what they
  // draw, like the lamp (see hideLamp): the stones' glow is a light, and a light leaving the
  // scene recompiles every lit shader
  let rackPropsHidden = false;
  const rackPropsShown = new Map();
  function hideRackProps(hidden) {
    if (hidden === rackPropsHidden) return;
    rackPropsHidden = hidden;
    if (hidden) {
      [runtime.gauntlet.gauntlet, runtime.handheld.nintendoSwitch, runtime.workstation.monitor].forEach((prop) => prop.traverse((o) => {
        // (the stones' halos are sprites)
        if (!o.isMesh && !o.isSprite) return;
        rackPropsShown.set(o, o.visible);
        o.visible = false;
      }));
    } else {
      rackPropsShown.forEach((visible, o) => (o.visible = visible));
      rackPropsShown.clear();
    }
  }
  // Each frame: easing in or out with the close-up, and kept centred on the rack wherever the
  // camera is
  function updateSpotlight(dt) {
    hideRackProps(runtime.camera.focus.name === "swords");
    const strength = spotUniforms.strength;
    strength.value += ((runtime.camera.focus.name === "swords" ? 1 : 0) - strength.value) * (1 - Math.pow(0.02, dt));
    // The room's own fill (ambient and sky) falls from ~2.6 at midday to ~0.3 at night; a light
    // key makes up what's missing, so the swords hold the same brightness at any hour, rain or
    // shine, without a daytime glare on top of an already bright room
    const dayFill = runtime.theme.DAYLIGHT.day.ambient + runtime.theme.DAYLIGHT.day.skyPower;
    const fillGap = Math.max(0, dayFill - runtime.core.ambient.intensity - runtime.core.skyFill.intensity);
    swordSpotlight.intensity = (SWORD_KEY + fillGap * SWORD_FILL_MAKEUP) * strength.value;
    spotlight.visible = strength.value > 0.005;
    if (!spotlight.visible) return;
    swordSpotlight.shadow.needsUpdate = true;
    runtime.swordRack.katanaRack.getWorldPosition(spotAt);
    swordSpotlight.target.position.copy(spotAt);
    swordSpotlight.position.copy(spotAt).add(screenAxis.set(0, 6, 12));
    spotEdge.copy(spotAt).project(runtime.core.camera);
    spotUniforms.center.value.set(spotEdge.x, spotEdge.y);
    const cx = spotEdge.x;
    const cy = spotEdge.y;
    spotUniforms.radius.value.set(
      Math.abs(spotEdge.copy(spotAt).add(screenAxis.set(SPOT_REACH.x, 0, 0)).project(runtime.core.camera).x - cx),
      Math.abs(spotEdge.copy(spotAt).add(screenAxis.set(0, SPOT_REACH.y, 0)).project(runtime.core.camera).y - cy),
    );
  }

  // Public state used by the other scene parts.
  return {
    get swordZoomTimer() { return swordZoomTimer; },
    set swordZoomTimer(value) { swordZoomTimer = value; },
    hideSwordCard,
    sayaCurve,
    hitAreaMat,
    showSwordCard,
    get slashing() { return slashing; },
    hoverHaki,
    HOVER_BARE,
    tossKitetsu,
    afterStrike,
    slashSword,
    swordSpotlight,
    updateFx,
    updateTrail,
    updateSpotlight,
    get rackPropsHidden() { return rackPropsHidden; },
    get shoutTimer() { return shoutTimer; },
    impactFlash,
  };
}
