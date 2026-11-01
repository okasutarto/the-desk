import * as THREE from "three";
import gsap from "gsap";
import { canvasTexture, drawEnmaBlade, drawEnmaFlower, drawWadoBlade, drawKitetsuBlade, drawBladeGlint } from "../textures";

export function createSwordRack(runtime) {
  // ---------- Zoro's three swords on a wall rack, beside the painting ----------
  // Two black wall brackets, each a plate with three curved hooks (the wavy arms of a sword
  // stand, turned to hang on the wall), and in them, top to bottom:
  // Wado Ichimonji: white saya and white wrap with black diamonds, a round gold tsuba
  // Sandai Kitetsu: red saya ringed in black, red wrap with black diamonds, a gold tsuba
  // Enma: purple saya with yellow flowers, a red cord and tassels, a lobed gold tsuba
  // World scale: each sword is about 90 cm long
  const KATANA_SCALE = 2.6;
  const RACK_TIERS = [0.6, 0, -0.6];
  const RACK_ARM_X = 1.0;
  // The shelf's close-up scrolls up to the gauntlet and the handheld, not the swords: they
  // have a close-up of their own
  const SHELF_TOP_EXTRA = 2.9;
  const katanaRack = new THREE.Group();
  // Beside the painting, level with it, clear of the gauntlet to its right.
  katanaRack.position.set(3.1, 9.6, runtime.room.WALL_Z + 0.25);
  katanaRack.scale.setScalar(KATANA_SCALE);
  runtime.room.room.add(katanaRack);

  const rackMat = runtime.core.toon("#181513");
  // A bracket in profile (x out from the wall, y up), extruded to its thickness
  const bracketShape = new THREE.Shape();
  const RACK_TOP = RACK_TIERS[0] + 0.36;
  const RACK_BOTTOM = RACK_TIERS[RACK_TIERS.length - 1] - 0.36;
  bracketShape.moveTo(0, RACK_BOTTOM);
  bracketShape.lineTo(0, RACK_TOP);
  bracketShape.quadraticCurveTo(0.1, RACK_TOP + 0.04, 0.1, RACK_TOP - 0.08);
  RACK_TIERS.forEach((y) => {
    bracketShape.lineTo(0.1, y + 0.06);
    // the cradle the sword rests in, then up to a rounded tip and back under the hook
    bracketShape.quadraticCurveTo(0.2, y - 0.13, 0.3, y - 0.04);
    bracketShape.quadraticCurveTo(0.33, y + 0.02, 0.35, y + 0.09);
    bracketShape.quadraticCurveTo(0.4, y + 0.1, 0.39, y + 0.02);
    bracketShape.quadraticCurveTo(0.37, y - 0.17, 0.22, y - 0.2);
    bracketShape.quadraticCurveTo(0.12, y - 0.2, 0.1, y - 0.27);
  });
  bracketShape.lineTo(0.1, RACK_BOTTOM + 0.08);
  bracketShape.quadraticCurveTo(0.1, RACK_BOTTOM - 0.04, 0, RACK_BOTTOM);
  const bracketGeo = new THREE.ExtrudeGeometry(bracketShape, { depth: 0.13, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 10 });
  bracketGeo.translate(0, 0, -0.065);
  bracketGeo.rotateY(-Math.PI / 2);
  [-RACK_ARM_X, RACK_ARM_X].forEach((x) => {
    katanaRack.add(runtime.core.at(runtime.core.mesh(bracketGeo, rackMat, { outline: 0.018 }), x, 0, 0));
    // two screws in the wall plate
    [RACK_TOP - 0.16, RACK_BOTTOM + 0.16].forEach((y) => {
      const screw = runtime.core.mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 10), runtime.core.toon("#c9a24a"), { outline: 0.006 });
      screw.rotation.z = Math.PI / 2;
      katanaRack.add(runtime.core.at(screw, x, y, 0.06));
    });
  });

  // How far the curve rises over the blade. Its sori (the most the back stands off the straight
  // line from the hilt to the tip) is a quarter of this: 2.3% of the blade, as on a real katana
  // (1.6 cm over 70 cm)
  const SORI = 0.2;
  const BLADE_L = 2.2;
  const bow = (x) => SORI * (x / BLADE_L) ** 2;
  // That curve is (to well under a hair) an arc of this radius about a point straight above the
  // saya's mouth, so a blade slides in and out of its saya by turning about that point
  const SORI_R = BLADE_L ** 2 / (2 * SORI);
  const drawTurn = (distance) => -distance / SORI_R;
  const bladeShape = (inset) => {
    const shape = new THREE.Shape();
    const steps = 16;
    shape.moveTo(0, -0.055 + inset);
    for (let i = 1; i <= steps; i++) {
      const x = (i / steps) * BLADE_L;
      shape.lineTo(x, bow(x) - 0.055 * (1 - 0.3 * (x / BLADE_L)) + inset);
    }
    // the kissaki: the edge sweeps up to the point in a convex curve (the fukura), carrying on
    // from the edge's own line before it turns, with the point near the back as the curve goes
    const edgeEnd = bow(BLADE_L) - 0.055 * 0.7 + inset;
    shape.quadraticCurveTo(BLADE_L + 0.11, edgeEnd + 0.11 * (2 * SORI / BLADE_L), BLADE_L + 0.14, bow(BLADE_L + 0.14) + 0.03);
    for (let i = steps; i >= 0; i--) {
      const x = (i / steps) * BLADE_L;
      shape.lineTo(x, bow(x) + 0.05 - (inset ? 0.05 : 0));
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.022, bevelEnabled: false });
    geo.translate(0, 0, -0.011);
    return geo;
  };
  const BLADE_SPAN = BLADE_L + 0.14;
  const Y_MIN = -0.06;
  const Y_MAX = SORI + 0.08;

  // Blade textures for each of the 3 swords
  // The shine that runs down a blade as it clears the saya ("shing"): an emissive bar whose
  // offset sweeps from the hilt to the point; parked off the blade the rest of the time
  const GLINT_OFF = 0.7;
  const bladeGlint = canvasTexture(512, 64);
  runtime.core.track(bladeGlint.texture);
  drawBladeGlint(bladeGlint.ctx, 512, 64);
  bladeGlint.texture.repeat.set(1 / BLADE_SPAN, 1 / (Y_MAX - Y_MIN));
  bladeGlint.texture.offset.set(GLINT_OFF, -Y_MIN / (Y_MAX - Y_MIN));
  const glintBlade = (delay = 0) => gsap.fromTo(bladeGlint.texture.offset, { x: GLINT_OFF }, { x: -GLINT_OFF, duration: 0.5, delay, ease: "power1.inOut", overwrite: true });
  const createBladeMat = (drawFn) => {
    const tex = canvasTexture(2048, 256);
    runtime.core.track(tex.texture);
    drawFn(tex.ctx, 2048, 256, { bow, length: BLADE_L, width: BLADE_SPAN, yMin: Y_MIN, yMax: Y_MAX });
    tex.texture.repeat.set(1 / BLADE_SPAN, 1 / (Y_MAX - Y_MIN));
    tex.texture.offset.set(0, -Y_MIN / (Y_MAX - Y_MIN));
    const mat = runtime.core.toon("#ffffff");
    mat.map = tex.texture;
    mat.emissive.set("#ffffff");
    mat.emissiveMap = bladeGlint.texture;
    return mat;
  };

  const wadoBladeMat = createBladeMat(drawWadoBlade);
  const kitetsuBladeMat = createBladeMat(drawKitetsuBlade);
  const enmaBladeMat = createBladeMat(drawEnmaBlade);

  // Enma crest decals
  const cord = runtime.core.toon("#e11d48");
  // Enma's tassels hang from pivots on the saya and swing like little pendulums: each frame they
  // lean toward gravity as the saya feels it (its own acceleration subtracted), so a drawn,
  // sheathed or wobbling saya sets them swaying, and they settle back to how they were tied
  const tasselSway = [];
  const swayPos = new THREE.Vector3();
  const swayQuat = new THREE.Quaternion();
  const swayPull = new THREE.Vector3();
  // A blade leaving or going home jolts its saya: a shove sideways and back for its tassels
  function kickTassels(saya, strength = 1) {
    tasselSway.forEach((t, i) => {
      if (t.saya === saya) t.spin.add(new THREE.Vector3((i % 2 ? 2.2 : -1.7) * strength, 0.5 * strength, 3.2 * strength));
    });
  }
  function updateTassels(dt) {
    if (!dt) return;
    tasselSway.forEach((t) => {
      t.saya.updateWorldMatrix(true, false);
      t.saya.getWorldPosition(swayPos);
      t.saya.getWorldQuaternion(swayQuat);
      if (!t.seen) {
        t.seen = true;
        t.lastPos.copy(swayPos);
      }
      const vel = swayPos.clone().sub(t.lastPos).divideScalar(dt);
      const accel = vel.clone().sub(t.lastVel).divideScalar(dt).clampLength(0, 60);
      t.lastPos.copy(swayPos);
      t.lastVel.copy(vel);
      // the pull the tassel feels, in the saya's own frame
      swayPull.set(0, -9.8, 0).addScaledVector(accel, -0.22).applyQuaternion(swayQuat.invert()).normalize();
      // the first frame fixes how far its tie leans it off true vertical
      if (!t.bias) t.bias = new THREE.Quaternion().setFromUnitVectors(swayPull, t.rest);
      const want = swayPull.applyQuaternion(t.bias);
      t.spin.addScaledVector(want.sub(t.dir), 70 * dt).multiplyScalar(Math.exp(-3.2 * dt));
      t.dir.addScaledVector(t.spin, dt).normalize();
      t.pivot.quaternion.setFromUnitVectors(t.rest, t.dir);
    });
  }
  const flowerTex = canvasTexture(64, 64);
  runtime.core.track(flowerTex.texture);
  drawEnmaFlower(flowerTex.ctx, 64, 64);
  // printed on the lacquer like the chair's crest, so it dims with the saya by dusk and night
  const flowerMat = runtime.core.printMaterial(flowerTex.texture, { transparent: true, depthWrite: false });
  const flowerGeo = runtime.core.track(new THREE.PlaneGeometry(0.11, 0.11));
  const crest = (parent, x, y, radius) => [-1, 1].forEach((side) => {
    const decal = new THREE.Mesh(flowerGeo, flowerMat);
    decal.position.set(x, y, side * (radius + 0.004));
    if (side < 0) decal.rotation.y = Math.PI;
    decal.raycast = runtime.core.noRaycast;
    decal.receiveShadow = true;
    parent.add(decal);
  });


  // Wado's glint on its tip as it cuts

  // Public state used by the other scene parts.
  return {
    bow,
    BLADE_L,
    kickTassels,
    drawTurn,
    SORI_R,
    RACK_TIERS,
    glintBlade,
    katanaRack,
    KATANA_SCALE,
    SORI,
    bladeShape,
    wadoBladeMat,
    kitetsuBladeMat,
    enmaBladeMat,
    crest,
    cord,
    tasselSway,
    SHELF_TOP_EXTRA,
    updateTassels,
  };
}
