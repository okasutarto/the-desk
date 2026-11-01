import * as THREE from "three";
import gsap from "gsap";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvasTexture, drawQuoteBubble } from "./textures";

export function createSceneMeshes(scene) {
  // ---------- materials & helpers ----------
  const disposables = new Set();
  const track = (o) => (disposables.add(o), o);

  const gradient = track(new THREE.DataTexture(new Uint8Array([70, 160, 255]), 3, 1, THREE.RedFormat));
  gradient.minFilter = gradient.magFilter = THREE.NearestFilter;
  gradient.needsUpdate = true;
  const toon = (color) => track(new THREE.MeshToonMaterial({ color, gradientMap: gradient }));

  const outlineMats = new Map();
  // Outlines are drawn in screen pixels, not world units: every prop gets a clear line of the
  // same weight whether the camera is pulled back or zoomed right in. The nominal width a
  // prop asks for (world units, 0.01–0.06) maps to roughly 2.5–4 CSS pixels: a shared base
  // every line has (2.2, less on a phone; see fitOutlines) plus 30 px a unit of its own.
  const outlineResolution = { value: new THREE.Vector2(1, 1) };
  const outlineBase = { value: 2.2 };
  const outlineMat = (thickness) => {
    if (!outlineMats.has(thickness)) {
      outlineMats.set(
        thickness,
        track(
          new THREE.ShaderMaterial({
            uniforms: {
              thickness: { value: thickness * 30 },
              base: outlineBase,
              resolution: outlineResolution,
              color: { value: new THREE.Color(0x000000) },
            },
            // (batched hulls take their placement from the batch; see toonBatch)
            vertexShader: `
              #include <batching_pars_vertex>
              uniform float thickness;
              uniform float base;
              uniform vec2 resolution;
              void main() {
                vec4 p = vec4(position, 1.0);
                vec3 n = normal;
                #ifdef USE_INSTANCING
                  p = instanceMatrix * p;
                  n = mat3(instanceMatrix) * n;
                #endif
                #ifdef USE_BATCHING
                  #include <batching_vertex>
                  p = batchingMatrix * p;
                  n = mat3(batchingMatrix) * n;
                #endif
                vec4 clip = projectionMatrix * modelViewMatrix * p;
                vec2 dir = (mat3(modelViewMatrix) * n).xy;
                float len = length(dir);
                dir = len > 1e-5 ? dir / len : vec2(0.0);
                clip.xy += dir * (base + thickness) * 2.0 / resolution * clip.w;
                gl_Position = clip;
              }`,
            fragmentShader: `
              uniform vec3 color;
              void main() { gl_FragColor = vec4(color, 1.0); }`,
            side: THREE.BackSide,
          }),
        ),
      );
    }
    return outlineMats.get(thickness);
  };

  // Hull geometry: positions only, welded so hard edges share one averaged normal (no cracks)
  const hullCache = new Map();
  const hullGeometry = (geo) => {
    if (!hullCache.has(geo)) {
      const g = geo.clone();
      Object.keys(g.attributes).forEach((k) => k !== "position" && g.deleteAttribute(k));
      const welded = mergeVertices(g, 1e-3);
      welded.computeVertexNormals();
      g.dispose();
      hullCache.set(geo, track(welded));
    }
    return hullCache.get(geo);
  };

  const noRaycast = () => {};
  // `hull` swaps in a simpler outer shape for the outline (a hollow mug outlines as a cylinder)
  function mesh(geo, material, { outline = 0.045, cast = true, hull: hullShape } = {}) {
    track(geo);
    const m = new THREE.Mesh(geo, material);
    m.castShadow = cast;
    m.receiveShadow = true;
    if (outline) {
      if (hullShape) track(hullShape);
      const hull = new THREE.Mesh(hullGeometry(hullShape || geo), outlineMat(outline));
      hull.raycast = noRaycast;
      m.add(hull);
    }
    return m;
  }
  const UP = new THREE.Vector3(0, 1, 0);
  const rbox = (w, h, d, r = 0.08) => new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2 - 1e-3));

  // A rounded rectangle in the xy plane, centred on the origin
  const roundedRectShape = (w, h, r) => {
    const shape = new THREE.Shape();
    shape.moveTo(-w / 2 + r, -h / 2);
    shape.lineTo(w / 2 - r, -h / 2);
    shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    shape.lineTo(w / 2, h / 2 - r);
    shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    shape.lineTo(-w / 2 + r, h / 2);
    shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    shape.lineTo(-w / 2, -h / 2 + r);
    shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return shape;
  };
  // A thin slab with big rounded corners in its face (rbox caps its radius at half the
  // thinnest side, so a phone-thin box would come out nearly square), its edges softly bevelled
  const phoneSlab = (w, h, d, r) => {
    const b = Math.min(0.015, d / 3);
    const geo = new THREE.ExtrudeGeometry(roundedRectShape(w - 2 * b, h - 2 * b, r - b), {
      depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 10,
    });
    geo.translate(0, 0, -(d - 2 * b) / 2);
    return geo;
  };
  // Places an object (and tips it about z), for building props out of parts
  const at = (obj, x, y, z = 0, rz = 0) => {
    obj.position.set(x, y, z);
    obj.rotation.z = rz;
    return obj;
  };

  // Paper, prints and labels: part self-lit so the print stays readable in any light, part toon
  // shaded so it still takes shadows and the neons' colour. The self-lit part is one level for
  // every print, which the theme turns down at dusk and night (see PRINT_GLOW in theme.js), so
  // the paper doesn't outshine the dim room around it.
  const PRINT_LIT = 0.5;
  const printMats = [];
  let printLevel = 0.6;
  const printGlow = {
    get level() { return printLevel; },
    set level(value) {
      printLevel = value;
      printMats.forEach((m) => (m.emissiveIntensity = value));
    },
  };
  // (`tint` colours a plain one with no print on it, like a photo's mat or a strip of tape)
  const printMaterial = (map, options = {}, tint = "#ffffff") => {
    const m = new THREE.MeshToonMaterial({ map, emissiveMap: map, gradientMap: gradient, ...options });
    m.color.set(tint).multiplyScalar(PRINT_LIT);
    m.emissive.set(tint);
    m.emissiveIntensity = printLevel;
    printMats.push(m);
    return track(m);
  };
  // A plane carrying a canvas texture. Screens and views (`unlit`) keep their exact colours
  const redrawers = [];
  function printed(w, h, px, draw, { unlit = false } = {}) {
    const t = canvasTexture(Math.round(w * px), Math.round(h * px));
    track(t.texture);
    const material = unlit ? track(new THREE.MeshBasicMaterial({ map: t.texture })) : printMaterial(t.texture);
    const plane = new THREE.Mesh(track(new THREE.PlaneGeometry(w, h)), material);
    plane.receiveShadow = !unlit;
    t.redraw = (...args) => {
      t.hotspots = draw(t.ctx, t.canvas.width, t.canvas.height, ...args) || [];
      t.texture.needsUpdate = true;
    };
    plane.userData.tex = t;
    redrawers.push(() => t.redraw());
    return plane;
  }
  // A quote bubble that pops up over a prop for a few seconds (the mug).
  // Sized in world units; it always faces the camera and draws over everything.
  const bubbleTimers = [];
  function speechBubble(width, height, print = {}) {
    const tex = canvasTexture(760, 400);
    track(tex.texture);
    const sprite = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: tex.texture, depthTest: false, transparent: true })));
    sprite.scale.set(0.001, 0.001, 1);
    sprite.renderOrder = 10;
    sprite.raycast = noRaycast;
    scene.add(sprite);
    const slot = bubbleTimers.push(null) - 1;
    const hide = () => {
      clearTimeout(bubbleTimers[slot]);
      gsap.to(sprite.scale, { x: 0.001, y: 0.001, duration: 0.2, ease: "power2.in", overwrite: true });
    };
    // `size` shrinks the bubble from its full width x height (a narrow view)
    const say = (quote, hold = 4200, size = 1) => {
      drawQuoteBubble(tex.ctx, 760, 400, quote, print);
      tex.texture.needsUpdate = true;
      const w = width * size;
      const h = height * size;
      gsap.fromTo(sprite.scale, { x: w * 0.16, y: h * 0.15 }, { x: w, y: h, duration: 0.4, ease: "back.out(2)", overwrite: true });
      clearTimeout(bubbleTimers[slot]);
      bubbleTimers[slot] = setTimeout(hide, hold);
    };
    return { sprite, say, hide };
  }


  // A rod between two points (lamp arms, plant stems, chair parts)
  function rod(a, b, radius, material, outline = 0.025) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const m = mesh(new THREE.CylinderGeometry(radius, radius, dir.length(), 12), material, { outline });
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(UP, dir.normalize());
    return m;
  }

  return {
    disposables, track, gradient, toon, outlineResolution, outlineBase, outlineMat, hullGeometry, noRaycast, mesh, UP, rbox, rod,
    roundedRectShape, phoneSlab, at, printMaterial, printGlow, redrawers, printed, bubbleTimers, speechBubble,
  };
}
