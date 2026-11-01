import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { canvasTexture, drawFamilyPortrait } from "../textures";

export function createLamp(runtime) {
  // ---------- desk lamp (back-left): a light switch for the night shift ----------
  // An Edison bulb lamp: a round walnut base, a black pole that rises from its back and hooks
  // over toward the desk, and a bare amber globe bulb hanging from a black socket, its filament
  // glowing when it's on.
  const lamp = new THREE.Group();
  runtime.core.scene.add(lamp);
  const jointMat = runtime.core.toon("#1a1714");
  // Over by the window wall, its pole just clear of the sill (which reaches out to x −8.38)
  const LAMP_BASE = new THREE.Vector3(-7.7, 0, -2.9);
  // Where the socket hangs, over the right of the base
  const SOCKET = new THREE.Vector3(-7.15, 3.35, -2.8);
  const lampBrass = runtime.core.toon("#c9a24a");
  const lampWood = runtime.core.toon("#8b5a34");
  lampWood.map = runtime.room.windowWood.texture;
  // The base: a thick walnut puck with a chamfered top edge, on a thin black felt pad
  const lampBase = runtime.core.mesh(new THREE.CylinderGeometry(0.6, 0.62, 0.18, 36), lampWood, { outline: 0.04 });
  lampBase.position.copy(LAMP_BASE).setY(0.11);
  const lampBaseTop = runtime.core.mesh(new THREE.CylinderGeometry(0.52, 0.6, 0.06, 36), lampWood, { outline: 0.02 });
  lampBaseTop.position.copy(LAMP_BASE).setY(0.23);
  const lampFelt = runtime.core.mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.02, 36), jointMat, { outline: 0.01, cast: false });
  lampFelt.position.copy(LAMP_BASE).setY(0.01);
  // The pole: straight up from the back of the base, a rounded bend over the top, and down to
  // the socket
  const POLE_X = LAMP_BASE.x - 0.4;
  const poleTop = SOCKET.y + 0.45;
  const polePath = new THREE.CurvePath();
  polePath.add(new THREE.LineCurve3(new THREE.Vector3(POLE_X, 0.24, SOCKET.z), new THREE.Vector3(POLE_X, poleTop - 0.35, SOCKET.z)));
  polePath.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(POLE_X, poleTop - 0.35, SOCKET.z), new THREE.Vector3(POLE_X, poleTop, SOCKET.z), new THREE.Vector3(POLE_X + 0.35, poleTop, SOCKET.z)));
  polePath.add(new THREE.LineCurve3(new THREE.Vector3(POLE_X + 0.35, poleTop, SOCKET.z), new THREE.Vector3(SOCKET.x - 0.22, poleTop, SOCKET.z)));
  polePath.add(new THREE.QuadraticBezierCurve3(new THREE.Vector3(SOCKET.x - 0.22, poleTop, SOCKET.z), new THREE.Vector3(SOCKET.x, poleTop, SOCKET.z), new THREE.Vector3(SOCKET.x, poleTop - 0.22, SOCKET.z)));
  const pole = runtime.core.mesh(new THREE.TubeGeometry(polePath, 96, 0.055, 12), jointMat, { outline: 0.025 });
  // a lampBrass flange where the pole meets the wood, and a lampBrass ferrule where it meets the socket
  const poleFoot = runtime.core.mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.06, 18), lampBrass, { outline: 0.012 });
  poleFoot.position.set(POLE_X, 0.29, SOCKET.z);
  const poleFerrule = runtime.core.mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.1, 16), lampBrass, { outline: 0.01 });
  poleFerrule.position.set(SOCKET.x, poleTop - 0.24, SOCKET.z);
  // The switch: a small black rocker on the base's rim
  const lampButton = runtime.core.at(runtime.core.mesh(runtime.core.rbox(0.12, 0.05, 0.08, 0.02), runtime.core.toon("#2a2523"), { outline: 0.01 }), LAMP_BASE.x + 0.4, 0.2, LAMP_BASE.z + 0.33);
  lamp.add(lampFelt, lampBase, lampBaseTop, pole, poleFoot, poleFerrule, lampButton);
  // The head hangs from the end of the pole: it holds the socket, the bulb and the light, and
  // swings from the pole on hover
  const lampHead = new THREE.Group();
  lampHead.position.copy(SOCKET);
  // A ribbed black socket with a lampBrass turn-key on its side and a lampBrass collar the bulb's
  // neck screws into
  const socket = runtime.core.mesh(new THREE.CylinderGeometry(0.15, 0.14, 0.42, 20), jointMat, { outline: 0.016 });
  const socketRibs = [0.12, 0.04, -0.04, -0.12].map((y) => {
    const rib = runtime.core.mesh(new THREE.TorusGeometry(0.152, 0.014, 6, 24), runtime.core.toon("#2c2826"), { outline: 0 });
    rib.rotation.x = Math.PI / 2;
    rib.position.y = y;
    return rib;
  });
  const turnKeyStem = runtime.core.mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 10), lampBrass, { outline: 0.008 });
  turnKeyStem.rotation.z = Math.PI / 2;
  turnKeyStem.position.set(0.19, 0.05, 0);
  const turnKey = runtime.core.mesh(runtime.core.rbox(0.03, 0.12, 0.09, 0.015), lampBrass, { outline: 0.01 });
  turnKey.position.set(0.25, 0.05, 0);
  const bulbCollar = runtime.core.mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.12, 18), lampBrass, { outline: 0.01 });
  bulbCollar.position.y = -0.27;
  const collarThreads = [-0.24, -0.29].map((y) => {
    const thread = runtime.core.mesh(new THREE.TorusGeometry(0.108, 0.01, 6, 20), runtime.core.toon("#9c7a2e"), { outline: 0 });
    thread.rotation.x = Math.PI / 2;
    thread.position.y = y;
    return thread;
  });
  // A G95 globe: a big round bulb on a short neck. The profile is traced from the tip up, so
  // the lathe's faces point outward.
  const BULB_Y = -0.86;
  const BULB_R = 0.5;
  const bulbProfile = [[0, -1.36], [0.17, -1.33], [0.33, -1.24], [0.45, -1.09], [0.5, -0.9], [0.46, -0.72], [0.33, -0.56], [0.17, -0.45], [0.11, -0.4], [0.1, -0.33]].map(([r, y]) => new THREE.Vector2(r, y));
  // Amber glass, flat-shaded like everything else; it brightens when the bulb is on
  const bulbMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#ecd3a3" }));
  const bulb = runtime.core.mesh(new THREE.LatheGeometry(bulbProfile, 40), bulbMat, { outline: 0.02, cast: false });
  // A soft white glint across the upper left of the glass
  const glintMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#fffaf0", transparent: true, opacity: 0.85 }));
  const bulbGlint = new THREE.Mesh(runtime.core.track(new THREE.TorusGeometry(Math.sqrt(BULB_R ** 2 - 0.36 ** 2), 0.022, 6, 20, 0.9)), glintMat);
  bulbGlint.position.set(0, BULB_Y, 0.36);
  bulbGlint.rotation.z = 1.85;
  bulbGlint.raycast = runtime.core.noRaycast;
  // Inside, drawn over the glass so they show through it: a clear glass stem up the middle and
  // a squirrel-cage filament, six wavy strands strung between a top and a bottom ring
  const filamentMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#a8742c", depthTest: false }));
  const bulbStemMat = runtime.core.track(new THREE.MeshBasicMaterial({ color: "#f6ead0", depthTest: false, transparent: true, opacity: 0.8 }));
  const filament = new THREE.Group();
  const bulbStem = new THREE.Mesh(runtime.core.track(new THREE.CylinderGeometry(0.025, 0.04, 0.5, 10)), bulbStemMat);
  bulbStem.position.y = -0.62;
  filament.add(bulbStem);
  const CAGE = { top: -0.62, bottom: -1.08, r: 0.16 };
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const points = Array.from({ length: 9 }, (_, k) => {
      const t = k / 8;
      const wobble = Math.sin(t * Math.PI * 4) * 0.025;
      return new THREE.Vector3(Math.cos(a) * (CAGE.r + wobble), CAGE.top + (CAGE.bottom - CAGE.top) * t, Math.sin(a) * (CAGE.r + wobble));
    });
    filament.add(new THREE.Mesh(runtime.core.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.01, 4)), filamentMat));
  }
  [CAGE.top, CAGE.bottom].forEach((y) => {
    const ring = new THREE.Mesh(runtime.core.track(new THREE.TorusGeometry(CAGE.r, 0.008, 4, 24)), filamentMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    filament.add(ring);
  });
  filament.children.forEach((part) => {
    part.renderOrder = 2;
    part.raycast = runtime.core.noRaycast;
  });
  // Only the small bulb halo is decorative; the room is lit and shadowed by the bulb itself.
  const radial = (stops) => {
    const tex = canvasTexture(128, 128);
    runtime.core.track(tex.texture);
    const g = tex.ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([at, color]) => g.addColorStop(at, color));
    tex.ctx.fillStyle = g;
    tex.ctx.fillRect(0, 0, 128, 128);
    return tex.texture;
  };
  const halo = new THREE.Sprite(runtime.core.track(new THREE.SpriteMaterial({ map: radial([[0, "rgba(255,240,190,1)"], [0.3, "rgba(255,206,110,0.55)"], [1, "rgba(255,190,90,0)"]]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 })));
  halo.scale.set(2.6, 2.6, 1);
  halo.position.y = BULB_Y;
  halo.raycast = runtime.core.noRaycast;
  function updateLampGlow() {
    // 0 off to 1 at the strength setLamp gives the light when it is on
    const k = Math.min(1, lampLight.intensity / 8);
    // Kept soft, so the bulb reads as a lamp rather than a white blowout
    halo.material.opacity = 0.55 * k;
    bulbMat.color.setRGB(0.93 + 0.07 * k, 0.83 + 0.06 * k, 0.64 - 0.06 * k);
    filamentMat.color.setRGB(0.66 + 0.34 * k, 0.45 + 0.27 * k, 0.17 + 0.13 * k);
  }
  // An exposed bulb emits in every direction from the filament, including toward the wall.
  const lampLight = new THREE.PointLight(0xffd394, 0, 16, 2);
  lampLight.position.y = BULB_Y;
  // A cube needs six faces; 512 per face keeps the local lamp's cost bounded.
  lampLight.shadow.mapSize.set(512, 512);
  lampLight.shadow.camera.near = 0.08;
  lampLight.shadow.camera.far = 16;
  lampLight.shadow.bias = -0.0002;
  lampLight.shadow.normalBias = 0.02;
  lampLight.shadow.radius = 5;
  lampHead.add(socket, ...socketRibs, turnKeyStem, turnKey, bulbCollar, ...collarThreads, bulb, bulbGlint, filament, halo, lampLight);
  lamp.add(lampHead);
  // In the window's close-up the lamp's pole stands right across the glass, so the lamp steps
  // out of that shot; only its meshes hide, so the bulb still lights the room
  let lampHidden = false;
  const lampShown = new Map();
  function hideLamp(hidden) {
    if (hidden === lampHidden) return;
    lampHidden = hidden;
    if (hidden) {
      lamp.traverse((o) => {
        if (!o.isMesh && !o.isSprite) return;
        lampShown.set(o, o.visible);
        o.visible = false;
      });
    } else {
      lampShown.forEach((visible, o) => (o.visible = visible));
      lampShown.clear();
    }
  }
  // The room's time of day lights the lamp for the night (see setTheme); a click only turns the
  // bulb on or off, at any hour, and leaves the time of day to the clock or the settings
  let lampOn = false;
  const setLamp = (on) => {
    lampOn = on;
    lampLight.intensity = on ? 8 : 0;
    lampLight.castShadow = on;
    updateLampGlow();
  };
  function switchLamp(on) {
    lampOn = on;
    gsap.killTweensOf(lampLight);
    gsap.to(lampLight, { intensity: on ? 8 : 0, duration: on ? 0.25 : 0.35, ease: "power2.out", onUpdate: updateLampGlow });
  }
  // Like a desk lamp with a mind of its own: on hover the bulb swings on its pole; on a click
  // the lamp crouches, hops, nods its bulb, and only then throws the switch
  const lampHeadRest = lampHead.rotation.clone();
  let lampHopping = false;
  runtime.core.register(lamp, {
    onHover: (on) => {
      if (lampHopping) return;
      // Swing the hanging bulb; the base and the pole stay put
      gsap.to(lampHead.rotation, { x: lampHeadRest.x + (on ? 0.12 : 0), z: lampHeadRest.z + (on ? 0.22 : 0), duration: on ? 0.32 : 0.6, ease: on ? "power2.out" : "elastic.out(1, 0.4)", overwrite: true });
      // a light tap of its metal joint
      if (on) hoverSound(lamp, (s) => s.tick({ pitch: 1.6 }));
    },
    onClick: () => {
      if (lampHopping) return;
      lampHopping = true;
      gsap.killTweensOf(lampHead.rotation);
      lampHead.rotation.copy(lampHeadRest);
      runtime.secrets.discover("lamp");
      gsap.timeline({ onComplete: () => (lampHopping = false) })
        .to(lamp.scale, { y: 0.88, duration: 0.12, ease: "power2.in" })
        .to(lamp.scale, { y: 1.06, duration: 0.15, ease: "power2.out" })
        .to(lamp.position, { y: 0.55, duration: 0.18, ease: "power2.out" }, "<")
        .to(lamp.position, { y: 0, duration: 0.2, ease: "power2.in" })
        .call(() => sfx.knock({ strength: 0.5 }))
        .to(lamp.scale, { y: 1, duration: 0.35, ease: "elastic.out(1.2, 0.4)" })
        .to(lampHead.rotation, { z: lampHeadRest.z - 0.25, duration: 0.12, yoyo: true, repeat: 3, ease: "sine.inOut" }, "<")
        .call(() => {
          sfx.click();
          switchLamp(!lampOn);
        });
      sfx.pop({ pitch: 1.2 });
    },
  });

  // Family keepsake: the anime-style family portrait in a white aluminium gallery frame with a
  // thin black lip round the photo and a brushed brass plate on the bottom rail, standing on
  // its own deep profile.
  const familyFrame = new THREE.Group();
  // Leant back a touch, its rear bottom edge dips just below its local origin.
  familyFrame.position.set(-5.75, 0.003, -1.2);
  familyFrame.scale.setScalar(0.8);
  familyFrame.rotation.set(-0.03, 0.08, 0);
  // (the frame's bottom edge on its local origin)
  const FY = 1.04;
  const frameMetal = runtime.core.toon("#f4f3ef");
  const frameBack = runtime.core.mesh(runtime.core.rbox(1.36, 2.08, 0.1, 0.04), frameMetal, { outline: 0.018 });
  frameBack.position.y = FY;
  familyFrame.add(frameBack);
  // A rounded rectangle with a rectangular window through it, its edges softly bevelled, `d`
  // deep and centred on z = 0: the frame's profile and its lip are each one piece, so their
  // corners are mitred rather than four bars butted together
  const ring = (w, h, r, hw, hh, d, b) => {
    const shape = runtime.core.roundedRectShape(w - 2 * b, h - 2 * b, r - b);
    // (the bevel pushes into the window too, so it's cut that much wider to end at hw × hh)
    shape.holes.push(runtime.core.roundedRectShape(hw + 2 * b, hh + 2 * b, b));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 2, curveSegments: 6 });
    geo.translate(0, 0, -(d - 2 * b) / 2);
    return geo;
  };
  // the profile, standing proud, with a thin black lip inside it right on the photo's edge
  familyFrame.add(runtime.core.at(runtime.core.mesh(ring(1.36, 2.08, 0.025, 1.04, 1.76, 0.16, 0.012), frameMetal, { outline: 0.014 }), 0, FY, 0.05));
  familyFrame.add(runtime.core.at(runtime.core.mesh(ring(1.055, 1.775, 0.008, 1.005, 1.725, 0.04, 0.004), runtime.core.toon("#1a1714"), { outline: 0.006 }), 0, FY, 0.075));
  // its sky follows the room: blue by day, moon and stars by night. It fills the lip's window,
  // its edge a hair under the lip so no gap shows
  const familyPhoto = runtime.core.printed(1.015, 1.735, 818, (c, w, h) => drawFamilyPortrait(c, w, h, { night: runtime.core.roomLight.night > 0.5 }));
  familyPhoto.position.set(0, FY, 0.064);
  familyFrame.add(familyPhoto);
  // a brushed brass plate on the bottom rail
  const plate = runtime.core.printed(0.4, 0.085, 700, (c, w, h) => {
    const sheen = c.createLinearGradient(0, 0, w, 0);
    sheen.addColorStop(0, "#b8913c");
    sheen.addColorStop(0.5, "#e6c873");
    sheen.addColorStop(1, "#b8913c");
    c.fillStyle = sheen;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "#6e5420";
    c.lineWidth = h * 0.1;
    c.strokeRect(0, 0, w, h);
    c.fillStyle = "#3d2e10";
    c.font = `800 ${Math.round(h * 0.5)}px 'Space Grotesk', sans-serif`;
    c.textAlign = "center";
    c.textBaseline = "middle";
    c.fillText("THE FAMILY", w / 2, h * 0.55);
  });
  plate.position.set(0, FY - 0.96, 0.132);
  familyFrame.add(plate);
  runtime.core.scene.add(familyFrame);
  runtime.core.register(familyFrame, {
    focus: "family",
    onHover: (on) => gsap.to(familyFrame.rotation, { x: on ? 0 : -0.03, y: on ? 0.14 : 0.08, duration: 0.35, ease: "power2.out", overwrite: true }),
  });

  // Public state used by the other scene parts.
  return {
    radial,
    lamp,
    LAMP_BASE,
    lampLight,
    jointMat,
    familyPhoto,
    setLamp,
    switchLamp,
    updateLampGlow,
    get lampHidden() { return lampHidden; },
    familyFrame,
    hideLamp,
    get lampHopping() { return lampHopping; },
  };
}
