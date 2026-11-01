import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { canvasTexture, drawStraw } from "../textures";

export function createStrawHat(runtime) {
  // Top: the Infinity Gauntlet at the left end (where it shows from the desk) and a katana on its
  // stand beside it. Luffy's straw hat hangs on the wall by the guitar: a wide straw brim, a round
  // crown and the red band
  // Woven straw on the brim and crown
  const strawWeave = canvasTexture(256, 256);
  runtime.core.track(strawWeave.texture);
  drawStraw(strawWeave.ctx, 256, 256);
  strawWeave.texture.wrapS = strawWeave.texture.wrapT = THREE.RepeatWrapping;
  strawWeave.texture.repeat.set(4, 2);
  const straw = runtime.core.toon("#ffffff");
  straw.map = strawWeave.texture;
  const strawHat = runtime.shelf.group(
    runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.74, 0.76, 0.05, 40), straw, { outline: 0.03 }), 0, 0.025, 0),
    runtime.core.at(runtime.core.mesh(new THREE.TorusGeometry(0.74, 0.03, 8, 40), runtime.core.toon("#d9a43a"), { outline: 0 }), 0, 0.04, 0),
    runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.2, 32), straw, { outline: 0.03 }), 0, 0.15, 0),
    runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.13, 32), runtime.core.toon("#d62828"), { outline: 0.02 }), 0, 0.12, 0),
    runtime.core.at(runtime.core.mesh(new THREE.SphereGeometry(0.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), straw, { outline: 0.03 }), 0, 0.25, 0),
  );
  strawHat.children[1].rotation.x = Math.PI / 2;
  strawHat.children[4].scale.y = 0.8;

  // Hung on the left wall beside the guitar from a nail by its cord, crown to the room, as if
  // tossed there after a session; it swings from the nail. In the hat's peg, x runs along the
  // wall, y up and z out into the room from the nail.
  const HAT_NAIL = new THREE.Vector3(runtime.room.SIDE_X + 0.12, 11.2, 19.7); // its brim level with the guitar's neck
  const hatPeg = new THREE.Group();
  hatPeg.position.copy(HAT_NAIL);
  hatPeg.rotation.set(0, Math.PI / 2, -0.25);
  runtime.room.room.add(hatPeg);
  // The nail, out from the wall with a round head; it stays put while the hat swings
  const nailMat = runtime.core.toon("#8b9099");
  const hatNail = runtime.core.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 10), nailMat, { outline: 0.012 });
  hatNail.rotation.z = Math.PI / 2;
  hatNail.position.copy(HAT_NAIL).add(new THREE.Vector3(0.18, 0, 0));
  const nailHead = runtime.core.mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 16), nailMat, { outline: 0.012 });
  nailHead.rotation.z = Math.PI / 2;
  nailHead.position.copy(HAT_NAIL).add(new THREE.Vector3(0.36, 0, 0));
  runtime.room.room.add(hatNail, nailHead);
  // Against the room (the desk is about 140 cm): a brim about 28 cm across, its back just off
  // the wall
  const HAT_SCALE = 2.7;
  const HAT_OFF_WALL = 0.12;
  // The cord is tied either side of the crown's base, 40 degrees off its top, with a little
  // knot at each tie; it hangs the hat far enough below the nail that the brim's top edge
  // clears it by 2.5 cm, so neither the nail nor the cord runs through the brim
  const TIE_ANGLE = (40 * Math.PI) / 180;
  const TIE_X = 0.42 * Math.sin(TIE_ANGLE);
  const TIE_UP = 0.42 * Math.cos(TIE_ANGLE);
  const BRIM_R = 0.74 + 0.03;
  const HAT_DROP = BRIM_R * HAT_SCALE + 0.25;
  const hung = runtime.core.at(strawHat, 0, -HAT_DROP, HAT_OFF_WALL);
  hung.rotation.x = Math.PI / 2;
  hung.scale.setScalar(HAT_SCALE);
  hatPeg.add(hung);
  // (the hat stands with its crown along its own +y; turned to face the room, its top is -z)
  const cordMat = runtime.core.toon("#7a5634");
  [-1, 1].forEach((side) => {
    const knot = runtime.core.mesh(new THREE.SphereGeometry(0.035, 10, 8), cordMat, { outline: 0.008, cast: false });
    knot.position.set(side * TIE_X, 0.075, -TIE_UP);
    strawHat.add(knot);
  });
  // Its cord: from each tie, taut up to the nail, and draped over the top of it, out near the
  // nail's head, in front of the brim's plane
  const CORD_TOP = 0.065;
  const CORD_OUT = 0.34;
  const tie = (side) => new THREE.Vector3(side * TIE_X * HAT_SCALE, -HAT_DROP + TIE_UP * HAT_SCALE, HAT_OFF_WALL + 0.075 * HAT_SCALE);
  const overNail = (side) => new THREE.Vector3(side * 0.07, 0.02, CORD_OUT);
  const hatCord = new THREE.CatmullRomCurve3([
    tie(-1),
    tie(-1).lerp(overNail(-1), 0.5),
    overNail(-1),
    new THREE.Vector3(0, CORD_TOP, CORD_OUT),
    overNail(1),
    tie(1).lerp(overNail(1), 0.5),
    tie(1),
  ]);
  // Held from the top of its loop over the nail, so a stretch only lengthens what hangs below
  const cordHang = runtime.core.at(new THREE.Group(), 0, CORD_TOP, 0);
  cordHang.add(runtime.core.at(runtime.core.mesh(new THREE.TubeGeometry(hatCord, 64, 0.022, 8), cordMat, { outline: 0.008, cast: false }), 0, -CORD_TOP, 0));
  hatPeg.add(cordHang);
  // Gomu gomu: the hat is rubber. Its cord stretches (`stretch.s`, 1 at rest) and the hat
  // sinks on it, drawn long and thin along the pull; let go, and it shoots back up past the
  // nail squashed flat, spins on its crown, bounces on its cord and swings before it settles.
  // A click is a yank; or grab it and pull it about yourself.
  const HAT_TILT = -0.25;
  const CORD_LEN = CORD_TOP - tie(1).y;
  const stretch = { s: 1 };
  const setStretch = () => {
    cordHang.scale.y = stretch.s;
    hung.position.y = CORD_TOP - CORD_LEN * stretch.s - TIE_UP * HAT_SCALE;
  };
  const hatGuitarBounds = new THREE.Box3();
  function constrainHat() {
    // Reserve the guitar's side of the wall, including its swing and the stretched brim.
    runtime.guitar.guitarSwing.updateWorldMatrix(true, false);
    hatGuitarBounds.setFromObject(runtime.guitar.guitarSwing);
    const radius = 0.8 * Math.max(hung.scale.x, hung.scale.y, hung.scale.z);
    const clearance = HAT_NAIL.z - hatGuitarBounds.max.z - radius - 0.12;
    const maxAngle = Math.asin(THREE.MathUtils.clamp(clearance / -hung.position.y, -1, 1));
    hatPeg.rotation.z = Math.min(hatPeg.rotation.z, maxAngle);
  }
  const stopHat = () => gsap.killTweensOf([stretch, hung.scale, hung.rotation, hatPeg.rotation]);
  // Let go from a stretch `from`, swung out to `angle`: the further it was pulled, the harder
  // it snaps, squashes and bounces
  function snapBack(from, angle) {
    stopHat();
    const power = THREE.MathUtils.clamp((from - 1) / 1.6, 0.25, 1);
    gsap.timeline({ onUpdate: setStretch })
      .to(stretch, { s: 1 - 0.45 * power, duration: 0.11, ease: "power3.in" }, 0)
      .to(hung.scale, { x: HAT_SCALE * (1 + 0.34 * power), z: HAT_SCALE * (1 - 0.38 * power), duration: 0.11, ease: "power3.in" }, 0)
      .to(stretch, { s: 1, duration: 1.5, ease: `elastic.out(${1 + 0.6 * power}, 0.22)` })
      .to(hung.scale, { x: HAT_SCALE, z: HAT_SCALE, duration: 1.3, ease: "elastic.out(1.6, 0.25)" }, "<");
    // swings back through and about the nail
    gsap.fromTo(hatPeg.rotation, { z: angle }, { z: HAT_TILT, duration: 2, ease: "elastic.out(1.3, 0.18)" });
    // and spins on its crown as it flies up, wobbling back straight
    gsap.timeline()
      .to(hung.rotation, { y: (Math.random() < 0.5 ? -1 : 1) * 0.7 * power, duration: 0.12, ease: "power2.out" })
      .to(hung.rotation, { y: 0, duration: 1.3, ease: "elastic.out(1.2, 0.3)" });
    sfx.boing();
    sfx.pop({ pitch: 0.5 });
  }
  // The yank: a little hop up, then pulled down long and thin on a squealing cord, held there
  // a beat trembling with the strain, and let go
  function gomuGomu() {
    stopHat();
    gsap.timeline({ onUpdate: setStretch, onComplete: () => snapBack(stretch.s, hatPeg.rotation.z) })
      .to(stretch, { s: 0.85, duration: 0.1, ease: "power2.out" })
      .to(hung.scale, { x: HAT_SCALE * 1.08, z: HAT_SCALE * 0.92, duration: 0.1, ease: "power2.out" }, "<")
      .to(stretch, { s: 2.6, duration: 0.42, ease: "power2.out" })
      .to(hung.scale, { x: HAT_SCALE * 0.8, z: HAT_SCALE * 1.35, duration: 0.42, ease: "power2.out" }, "<")
      // swung out away from the guitar
      .to(hatPeg.rotation, { z: HAT_TILT - 0.35, duration: 0.42, ease: "power2.out" }, "<")
      .to(stretch, { s: 2.5, duration: 0.03, repeat: 5, yoyo: true, ease: "none" });
    sfx.rubber({ duration: 0.45, delay: 0.08 });
  }
  // Grab and pull: the hat follows the pointer across a plane just off the wall, its cord
  // stretching to reach and swinging round to point at it; let go and it snaps back. In the
  // nail's own frame (like the peg's, untilted), straight down is angle 0.
  const hatPullPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), -(HAT_NAIL.x + HAT_OFF_WALL + 0.3));
  const hatFrame = new THREE.Object3D();
  hatFrame.position.copy(HAT_NAIL);
  hatFrame.rotation.y = Math.PI / 2;
  runtime.room.room.add(hatFrame);
  const hatReachPoint = new THREE.Vector3();
  function hatReach(ray) {
    if (!ray.intersectPlane(hatPullPlane, hatReachPoint)) return null;
    hatFrame.updateMatrixWorld();
    hatFrame.worldToLocal(hatReachPoint);
    return { length: Math.hypot(hatReachPoint.x, hatReachPoint.y), angle: Math.atan2(hatReachPoint.x, -hatReachPoint.y) };
  }
  function grabHat(drag, ray) {
    const reach = hatReach(ray);
    if (!reach) return false;
    Object.assign(drag, { length: reach.length / stretch.s, turn: reach.angle - hatPeg.rotation.z, pull: stretch.s, lastSound: 0 });
    return true;
  }
  function pullHat(drag, ray, time) {
    const reach = hatReach(ray);
    if (!reach) return;
    if (!drag.held) {
      drag.held = true;
      stopHat();
    }
    drag.pull = THREE.MathUtils.clamp(reach.length / drag.length, 0.75, 3.2);
    stretch.s = drag.pull;
    hatPeg.rotation.z = THREE.MathUtils.clamp(reach.angle - drag.turn, -1.3, 1.3);
    // drawn long and thin along the pull
    const strain = Math.max(0, drag.pull - 1);
    hung.scale.set(HAT_SCALE * (1 - 0.1 * strain), HAT_SCALE, HAT_SCALE * (1 + 0.18 * strain));
    setStretch();
    if (strain > 0.15 && time - drag.lastSound > 180) {
      sfx.rubber({ duration: 0.25 });
      drag.lastSound = time;
    }
  }
  function releaseHat(drag) {
    snapBack(drag.pull, hatPeg.rotation.z);
    sfx.shishishi({ delay: 0.45 });
    runtime.secrets.discover("luffy");
  }
  runtime.core.register(hatPeg, {
    onHover: (on) => {
      if (!on || gsap.isTweening(stretch)) return;
      gsap.fromTo(hatPeg.rotation, { z: HAT_TILT - 0.1 }, { z: HAT_TILT, duration: 1, ease: "elastic.out(1, 0.3)" });
      hoverSound(hatPeg, (s) => s.rubber({ duration: 0.25 }));
    },
    onClick: () => {
      gomuGomu();
      sfx.shishishi({ delay: 1.1 });
      runtime.secrets.discover("luffy");
    },
  });

  // Public state used by the other scene parts.
  return {
    hatPeg,
    pullHat,
    releaseHat,
    grabHat,
    constrainHat,
  };
}
