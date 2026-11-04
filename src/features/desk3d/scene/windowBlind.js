import * as THREE from "three";
import gsap from "gsap";
import { sfx } from "@/shared/composables/useSfx";
import { canvasTexture, drawBlindCloth, blindRollColour } from "../textures";
import { BLIND_PATTERNS, DEFAULT_BLIND } from "../blindFinishes";

export function createWindowBlind(runtime) {
  // ---------- a roller blind over the window ----------
  // Cloth on a roller above the frame, worked by a bead chain on the left (the
  // side nearer the desk's view, easy to reach). It starts rolled up, out of the view; the
  // chain lets it down in two steps and draws it back up. The roll fattens as the fabric winds
  // onto it, the chain runs while it turns, and the fabric really stops the window's light, so
  // the sunlit patch on the wall and desk shrinks with it.
  const BLIND_W = runtime.room.GLASS.x * 2 + 0.5;
  const ROLL_Y = runtime.room.GLASS.y + 0.2 + 0.17; // the roller's axis, just above the frame
  const ROLL_Z = 0.36; // clear of the catch and the glazing bars
  const ROLL_CORE = 0.05;
  const ROLL_FULL = 0.045; // what the whole length of fabric adds to the roll's radius
  const BAR_H = 0.08;
  const FULL_DROP = ROLL_Y - (-(runtime.room.GLASS.y + 0.2) + 0.07 + BAR_H / 2 + 0.01); // down to the sill
  const MIN_DROP = 0.13; // rolled up, the bottom bar tucks under the roll
  const FABRIC_TILE = 0.7; // world size of one repeat of the weave
  const blindGroup = new THREE.Group();
  runtime.room.windowGroup.add(blindGroup);
  // The cloth, drawn like the rest of the room in flat colour: plain with only a hint of weave,
  // or a clean print. Its print and colour are picked in settings (drawBlindCloth) and
  // repainted in place on the same texture.
  const blindPrint = canvasTexture(256, 256);
  runtime.core.track(blindPrint.texture);
  blindPrint.texture.wrapS = blindPrint.texture.wrapT = THREE.RepeatWrapping;
  blindPrint.texture.needsUpdate = true;
  blindPrint.texture.repeat.set(BLIND_W / FABRIC_TILE, 1);
  const blindCloth = { ...DEFAULT_BLIND };
  // By day the sun behind it shows through a little, so the cloth glows; by night it doesn't
  const blindFabric = runtime.core.toon("#ffffff");
  blindFabric.map = blindPrint.texture;
  blindFabric.emissive.set("#ffe9c8");
  blindFabric.emissiveMap = blindPrint.texture;
  blindFabric.emissiveIntensity = 0.2;
  // Each moving part shadows the window's light alone, through a twin drawn only in its pass
  const blindPart = (geo, material, outline) => {
    const part = runtime.core.mesh(geo, material, { outline, cast: false });
    part.add(runtime.room.windowShadow(geo));
    return part;
  };
  const rollMat = runtime.core.toon("#7f858f");
  // the roll: a flat-shaded cylinder along x, scaled to the cloth wound on it
  const roll = blindPart(new THREE.CylinderGeometry(1, 1, BLIND_W, 20, 1).rotateZ(Math.PI / 2), rollMat, 0.025);
  roll.position.set(0, ROLL_Y, ROLL_Z);
  // the hanging cloth: a thin unit slab hung from its top edge, stretched to the drop, with
  // the same ink outline as every other prop
  const fabricSlab = runtime.core.track(new THREE.BoxGeometry(1, 1, 0.015).translate(0, -0.5, 0));
  const fabric = blindPart(fabricSlab, blindFabric, 0.03);
  // White end brackets on the wall, carrying the roll
  const bracketMat = runtime.core.toon("#f4f4f2");
  [-1, 1].forEach((side) => {
    const x = side * (BLIND_W / 2 + 0.04);
    const plate = runtime.core.mesh(runtime.core.rbox(0.07, 0.28, ROLL_Z - runtime.room.WINDOW_DEPTH + 0.1, 0.025), bracketMat, { outline: 0.02, cast: false });
    plate.position.set(x, ROLL_Y + 0.02, (ROLL_Z + runtime.room.WINDOW_DEPTH) / 2 + 0.02);
    blindGroup.add(plate);
  });
  // The control end on the left: a round housing the chain runs over
  const blindHousing = runtime.core.mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 20).rotateZ(Math.PI / 2), bracketMat, { outline: 0.02, cast: false });
  blindHousing.position.set(-BLIND_W / 2 - 0.02, ROLL_Y, ROLL_Z);
  // The bottom bar: a chunky charcoal rail at the hem, with a brass pull at its middle (the
  // window catch's brass)
  const blindInk = runtime.core.toon("#3a3d44");
  const bottomBar = blindPart(runtime.core.rbox(BLIND_W + 0.04, BAR_H, 0.07, 0.03), blindInk, 0.02);
  const pull = new THREE.Group();
  const pullCord = runtime.core.mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), blindInk, { outline: 0.008, cast: false });
  pullCord.position.y = -0.1;
  const pullKnob = runtime.core.mesh(new THREE.SphereGeometry(0.045, 12, 10), runtime.room.brass, { outline: 0.012, cast: false });
  pullKnob.position.y = -0.2;
  pull.add(pullCord, pullKnob);
  bottomBar.add(pull);
  blindGroup.add(roll, fabric, bottomBar, blindHousing);
  // The bead chain: a loop hanging from the housing, front run and back run, as chunky white
  // inked beads (instanced, outline and all). The beads slide along the loop as the roller turns.
  const CHAIN_LEN = 2.3;
  const BEAD_GAP = 0.075;
  const BEADS = Math.floor(CHAIN_LEN / BEAD_GAP);
  const chainX = -BLIND_W / 2 - 0.06;
  const beadGeo = runtime.core.track(new THREE.SphereGeometry(0.03, 10, 8));
  const beads = new THREE.InstancedMesh(beadGeo, bracketMat, BEADS * 2);
  beads.frustumCulled = false;
  beads.raycast = runtime.core.noRaycast;
  const beadOutline = new THREE.InstancedMesh(runtime.core.hullGeometry(beadGeo), runtime.core.outlineMat(0.008), BEADS * 2);
  beadOutline.instanceMatrix = beads.instanceMatrix;
  beadOutline.frustumCulled = false;
  beadOutline.raycast = runtime.core.noRaycast;
  const blindChain = new THREE.Group();
  blindChain.position.set(chainX, ROLL_Y, ROLL_Z);
  // a fat invisible handle, so the thin chain is easy to catch: brought out into the room past
  // the cloth, so from the desk's angle a ray meets it before the blind or the window
  const chainHit = new THREE.Mesh(runtime.core.track(new THREE.BoxGeometry(0.36, CHAIN_LEN + 0.2, 0.5)), runtime.room.shadowOnly);
  chainHit.position.set(-0.04, -CHAIN_LEN / 2, 0.2);
  chainHit.visible = false;
  // a brass weight at the bottom of the loop keeps the chain hanging straight
  const chainWeight = runtime.core.mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12), runtime.room.brass, { outline: 0.012, cast: false });
  chainWeight.position.y = -CHAIN_LEN - 0.06;
  blindChain.add(beads, beadOutline, chainHit, chainWeight);
  blindGroup.add(blindChain);
  // lift: 1 rolled up (the start, so the view stays clear), 0 all the way down
  // sway: the cloth swinging out from the roll a little as it settles
  const blind = { lift: 1, sway: 0 };
  const beadAt = new THREE.Matrix4();
  // The chain swings like a loose string, not a rod: each bead is carried out by the swing in
  // proportion to how far down it hangs (more than linearly, so the bottom whips), and the
  // weight goes with the last of them. x is across the blind, z out into the room.
  const chainSwing = { x: 0, z: 0 };
  let chainRun = 0;
  function placeBeads() {
    const bend = (depth) => (Math.max(0, depth) / CHAIN_LEN) ** 1.6;
    for (let i = 0; i < BEADS; i++) {
      const front = i * BEAD_GAP + chainRun;
      const back = i * BEAD_GAP + BEAD_GAP - chainRun;
      beads.setMatrixAt(i, beadAt.makeTranslation(chainSwing.x * bend(front), -front, 0.04 + chainSwing.z * bend(front)));
      beads.setMatrixAt(BEADS + i, beadAt.makeTranslation(chainSwing.x * bend(back), -back, -0.04 + chainSwing.z * bend(back)));
    }
    beads.instanceMatrix.needsUpdate = true;
    chainWeight.position.set(chainSwing.x, -CHAIN_LEN - 0.06, chainSwing.z);
    chainWeight.rotation.set(chainSwing.z * 1.5, 0, -chainSwing.x * 1.5);
  }
  // a nudge: out one way, then swinging back and forth, smaller each time, until it hangs still
  const swingChain = (x, z) => gsap.fromTo(chainSwing, { x, z }, { x: 0, z: 0, duration: 2.2, ease: "elastic.out(1, 0.18)", onUpdate: placeBeads, overwrite: true });
  function updateBlind() {
    const drop = FULL_DROP + (MIN_DROP - FULL_DROP) * blind.lift;
    const radius = ROLL_CORE + ROLL_FULL * (1 - drop / FULL_DROP);
    roll.scale.set(1, radius, radius);
    // hung from the roll's front, straight down to the bar. The window behind stops it, so the
    // hem only ever swings out into the room (a positive sway would carry it in, and let well
    // down even a small one put it through the glass): a swing back toward the glass bumps it
    // and leaves it hanging straight.
    const sway = Math.min(0, blind.sway);
    fabric.position.set(0, ROLL_Y, ROLL_Z + radius);
    fabric.scale.set(BLIND_W, drop, 1);
    fabric.rotation.x = sway;
    // the print stays put on the cloth, anchored at the hem, as it unrolls
    blindPrint.texture.repeat.y = drop / FABRIC_TILE;
    bottomBar.position.set(0, ROLL_Y - drop * Math.cos(sway), ROLL_Z + radius - drop * Math.sin(sway));
    bottomBar.rotation.x = sway;
    // the chain runs down the front and up the back as the roll turns
    chainRun = ((drop * 3) % BEAD_GAP + BEAD_GAP) % BEAD_GAP;
    placeBeads();
  }
  updateBlind();
  // Repaint the cloth (and the roll it winds onto) in a new print or colour; either may be
  // left out to keep what's there. Unknown prints and malformed colours are ignored.
  function setBlindCloth({ pattern, colour } = {}) {
    if (Object.hasOwn(BLIND_PATTERNS, pattern)) blindCloth.pattern = pattern;
    if (/^#[0-9a-f]{6}$/i.test(colour || "")) blindCloth.colour = colour;
    drawBlindCloth(blindPrint.ctx, 256, blindCloth);
    blindPrint.texture.needsUpdate = true;
    rollMat.color.set(blindRollColour(blindCloth.colour));
  }
  setBlindCloth(runtime.options.blind);
  // Click the window to look out; click again for a flock of birds (or, at night, a shooting
  // star). Three quick clicks bring the rain, or stop it.
  const lookOut = () => {
    const now = performance.now();
    runtime.room.outside.clicks = runtime.room.outside.clicks.filter((at) => now - at < 1500).concat(now);
    if (runtime.room.outside.clicks.length >= 3) {
      runtime.room.outside.clicks = [];
      runtime.room.outside.rainTarget = runtime.room.outside.rainTarget ? 0 : 0.9;
      runtime.secrets.discover("rain");
      sfx.patter({ duration: 0.8, volume: 0.3 });
      return;
    }
    if (runtime.room.dayPart() === "night") {
      if (runtime.room.outside.t - runtime.room.outside.starAt < 1.6) return;
      runtime.room.outside.starAt = runtime.room.outside.t;
      runtime.secrets.discover("star");
      sfx.sparkle({ delay: 0.15, volume: 0.3 });
    } else {
      if (runtime.room.outside.t - runtime.room.outside.flockAt < 2) return;
      runtime.room.outside.flockAt = runtime.room.outside.t;
      [0.3, 0.75, 1.3].forEach((delay) => sfx.chirp({ delay, volume: 0.3 }));
    }
  };

  // Public state used by the other scene parts.
  return {
    lookOut,
    bottomBar,
    BAR_H,
    blind,
    updateBlind,
    blindChain,
    swingChain,
    pull,
    blindFabric,
    blindCloth,
    setBlindCloth,
  };
}
