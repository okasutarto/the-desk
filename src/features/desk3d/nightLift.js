import * as THREE from "three";

// Near-black props (the chair, a black headset) take so little of the night's dim fill that
// they sink into the dark floor, and their black ink outlines with them. By night their own
// colour is lifted by a faint, cool moonlit amount: added, so a near-black finish gains its
// shape back while a white one barely changes. `update(night)` follows the room's day/night
// blend (0 day, 1 night). A colour set from elsewhere (a finish picked in the settings) is
// taken as the new base on the next update, so the finish setters don't need to know.
export function createNightLift() {
  const entries = [];
  let shownNight = -1;
  return {
    add(materials, lift) {
      const amount = new THREE.Color(lift);
      materials.forEach((mat) => entries.push({ mat, lift: amount, base: mat.color.clone(), shown: mat.color.clone() }));
      shownNight = -1;
    },
    update(night) {
      entries.forEach((entry) => {
        const repainted = !entry.mat.color.equals(entry.shown);
        if (repainted) entry.base.copy(entry.mat.color);
        if (!repainted && night === shownNight) return;
        entry.mat.color.copy(entry.lift).multiplyScalar(night).add(entry.base);
        entry.shown.copy(entry.mat.color);
      });
      shownNight = night;
    },
  };
}

// Every toon material under the given objects, once each
export function toonMaterialsUnder(...roots) {
  const found = new Set();
  roots.forEach((root) => root?.traverse((object) => {
    [].concat(object.material || []).forEach((mat) => mat.isMeshToonMaterial && found.add(mat));
  }));
  return [...found];
}
