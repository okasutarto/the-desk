import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { canvasTexture, drawFur, drawSisal } from "../textures";

export function createCatTree(runtime) {
  // ---------- cat tree: Oyen's, under the About board ----------
  // A 40 cm carpeted base with a condo on it, two sisal posts, a step half way up with a pom-pom
  // dangling under it, and a round bed on top at 67 cm. The bed is one of her spots: she naps
  // there between moves, and clicking the tree calls her up to it (the pom-pom gets a swat).
  const tree = new THREE.Group();
  // Back by the wall under the About board, centred on it, clear of the wastebasket. The top
  // bed reaches furthest back (2.1 behind the origin); it stands 15 mm off the wall's face.
  tree.position.set(runtime.aboutBoard.aboutBoard.position.x, runtime.room.FLOOR_Y, runtime.room.WALL_Z + 0.12 + 2.25);
  runtime.core.scene.add(tree);
  const carpet = runtime.core.toon("#b9a8e6");
  const carpetDark = runtime.core.toon("#8f7cc4");
  const carpetTex = canvasTexture(128, 128);
  runtime.core.track(carpetTex.texture);
  drawFur(carpetTex.ctx, 128, 128);
  carpetTex.texture.wrapS = carpetTex.texture.wrapT = THREE.RepeatWrapping;
  carpetTex.texture.repeat.set(2, 2);
  [carpet, carpetDark].forEach((mat) => (mat.map = carpetTex.texture));
  const sisalTex = canvasTexture(128, 256);
  runtime.core.track(sisalTex.texture);
  drawSisal(sisalTex.ctx, 128, 256);
  sisalTex.texture.wrapS = sisalTex.texture.wrapT = THREE.RepeatWrapping;
  const ink = runtime.core.toon("#1a1714");

  const BASE_H = 0.3;
  tree.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(4.0, BASE_H, 4.0, 0.1), carpetDark, { outline: 0.025 }), 0, BASE_H / 2, 0));
  // The condo, back left: a carpeted box with a round doorway toward the room
  const CONDO = { x: -0.55, z: -0.45, w: 2.5, h: 2.3 };
  const CONDO_TOP = BASE_H + CONDO.h;
  tree.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(CONDO.w, CONDO.h, CONDO.w, 0.12), carpet, { outline: 0.025 }), CONDO.x, BASE_H + CONDO.h / 2, CONDO.z));
  const door = runtime.core.mesh(new THREE.CircleGeometry(0.72, 28), ink, { outline: 0, cast: false });
  door.position.set(CONDO.x, BASE_H + CONDO.h * 0.45, CONDO.z + CONDO.w / 2 + 0.006);
  const doorLip = runtime.core.mesh(new THREE.TorusGeometry(0.74, 0.07, 8, 28), carpetDark, { outline: 0.012, cast: false });
  doorLip.position.copy(door.position);
  tree.add(door, doorLip);

  // Sisal posts: one from the base up to the step, one from the condo's roof up to the bed
  const STEP = { x: 0.65, z: 0.75, w: 2.6, d: 2.0, y: 4.0, t: 0.25 };
  const BED = { x: -0.45, z: -0.4, r: 1.7, y: 6.4, t: 0.3 };
  const post = (x, z, y0, y1) => {
    const h = y1 - y0;
    const mat = runtime.core.toon("#ffffff");
    mat.map = sisalTex.texture.clone();
    mat.map.repeat.set(2, h / 2.2);
    mat.map.needsUpdate = true;
    runtime.core.track(mat.map);
    tree.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.3, 0.3, h, 20), mat, { outline: 0.02 }), x, y0 + h / 2, z));
  };
  post(STEP.x + 0.6, STEP.z + 0.3, BASE_H, STEP.y - STEP.t / 2);
  post(BED.x, BED.z, CONDO_TOP, BED.y - BED.t / 2);
  tree.add(runtime.core.at(runtime.core.mesh(runtime.core.rbox(STEP.w, STEP.t, STEP.d, 0.08), carpetDark, { outline: 0.02 }), STEP.x, STEP.y, STEP.z));
  // The bed on top: a carpeted disc with a soft bolster round its edge
  tree.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(BED.r, BED.r * 0.94, BED.t, 32), carpetDark, { outline: 0.02 }), BED.x, BED.y, BED.z));
  const bolster = runtime.core.mesh(new THREE.TorusGeometry(BED.r - 0.2, 0.24, 10, 36), carpet, { outline: 0.018 });
  bolster.rotation.x = Math.PI / 2;
  bolster.position.set(BED.x, BED.y + BED.t / 2 + 0.1, BED.z);
  tree.add(bolster);

  // The pom-pom on its string under the step's outer corner, out past the condo: it swings from
  // the top of the string
  const toyPivot = new THREE.Group();
  toyPivot.position.set(STEP.x + STEP.w / 2 - 0.2, STEP.y - STEP.t / 2, STEP.z - STEP.d / 2 + 0.25);
  tree.add(toyPivot);
  const STRING = 1.1;
  toyPivot.add(runtime.core.at(runtime.core.mesh(new THREE.CylinderGeometry(0.018, 0.018, STRING, 6), ink, { outline: 0, cast: false }), 0, -STRING / 2, 0));
  const pomMat = runtime.core.toon("#ff5fa2");
  pomMat.map = carpetTex.texture;
  const pom = runtime.core.at(runtime.core.mesh(new THREE.SphereGeometry(0.24, 16, 12), pomMat, { outline: 0.012 }), 0, -STRING - 0.2, 0);
  toyPivot.add(pom);
  function swing(strength) {
    gsap.fromTo(toyPivot.rotation, { z: strength, x: -strength * 0.4 }, { z: 0, x: 0, duration: 1.6 + strength * 2, ease: "elastic.out(1, 0.2)", overwrite: true });
  }

  // Where Oyen lies, in the tree's own space, and her way there from the desk side of the room
  // (world points): down in front of the desk, along the floor clear of the dumbbells and the
  // wastebasket, and up onto the step
  tree.updateMatrixWorld(true);
  const PERCH = new THREE.Vector3(BED.x, BED.y + BED.t / 2 + 0.02, BED.z);
  const floor = runtime.room.FLOOR_Y + 0.08;
  const PATH = [
    new THREE.Vector3(5.0, floor, 5.0),
    new THREE.Vector3(10.0, floor, 4.2),
    new THREE.Vector3(tree.position.x - 4.3, floor, 2.8),
    tree.localToWorld(new THREE.Vector3(STEP.x + 0.2, STEP.y + STEP.t / 2 + 0.02, STEP.z)),
  ];

  runtime.core.register(tree, {
    onHover: (on) => {
      if (!on) return;
      swing(0.35);
      hoverSound(tree, (s) => s.whoosh({ duration: 0.2 }));
    },
    // A swat at the pom-pom, and Oyen comes over to see about it
    onClick: () => {
      swing(0.9);
      sfx.squeak();
      runtime.cat.catToTree();
    },
  });

  // Public state used by the other scene parts.
  return { tree, toyPivot, PERCH, PATH };
}
