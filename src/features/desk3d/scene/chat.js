import * as THREE from "three";
import gsap from "gsap";
import { hoverSound, sfx } from "@/shared/composables/useSfx";
import { chatErrorReply, getStreamingResponse, toHistory } from "@/shared/services/chatApi";
import { canvasTexture, drawChatScreen, drawSatinFinish, drawGlassSheen } from "../textures";
import { DEVICE_FINISHES } from "../deviceFinishes";

export function createChat(runtime) {
  // ---------- phone on a stand (AI chat) ----------
  // The chat with the AI assistant runs on the phone's screen: type (or tap a suggested
  // question), the reply streams in, the wheel scrolls back through it.
  const phoneStand = new THREE.Group();
  phoneStand.scale.setScalar(0.84);
  phoneStand.position.set(4.15, 0, -0.6);
  phoneStand.rotation.y = -0.3;
  runtime.core.scene.add(phoneStand);
  const standMat = runtime.core.toon("#222222");
  const standBase = runtime.core.mesh(runtime.core.rbox(1.1, 0.14, 0.9, 0.04), standMat, { outline: 0.03 });
  standBase.position.y = 0.07;
  const standBack = runtime.core.mesh(runtime.core.rbox(0.7, 1.2, 0.1, 0.03), standMat, { outline: 0.03 });
  standBack.position.set(0, 0.6, -0.3);
  standBack.rotation.x = -0.28;
  const phone = new THREE.Group();
  phone.position.set(0, 1.12, -0.12);
  phone.rotation.x = -0.28;
  let unread = true;
  const chat = { messages: [], input: "", active: false, waiting: false, scroll: 0, maxScroll: 0 };
  let chatDirty = false;
  let chatTypingAt = 0;
  // An iPhone 17 Pro Max: a tall aluminium unibody with a thin, even black border
  // round a screen whose corners follow the body's, the Dynamic Island printed at its top
  // (drawChatScreen), the buttons down both sides, and on the back the full-width camera
  // plateau: three big lenses in a triangle, the flash and LiDAR beside them, and the logo
  // anodised aluminium: a satin stipple under the colour (which it darkens a little, hence
  // the colours a shade brighter than the finish they read as)
  const phoneSatin = canvasTexture(128, 128);
  runtime.core.track(phoneSatin.texture);
  drawSatinFinish(phoneSatin.ctx, 128, 128, { grain: 0.08 });
  phoneSatin.texture.wrapS = phoneSatin.texture.wrapT = THREE.RepeatWrapping;
  phoneSatin.texture.repeat.set(3, 3);
  const phoneFinish = runtime.core.toon("#922d40");
  phoneFinish.map = phoneSatin.texture;
  const phoneTrim = runtime.core.toon("#70202f");
  phoneTrim.map = phoneSatin.texture;
  function setPhoneFinish(finish) {
    if (!Object.hasOwn(DEVICE_FINISHES.phone.finishes, finish)) return;
    const coat = DEVICE_FINISHES.phone.finishes[finish];
    phoneFinish.color.set(coat.shell);
    phoneTrim.color.set(coat.trim);
  }
  setPhoneFinish(runtime.options.deviceFinishes?.phone || DEVICE_FINISHES.phone.default);
  const PHONE_W = 0.95;
  const PHONE_H = 1.95;
  const phoneScreen = runtime.core.printed(0.87, 1.87, 700, (c, w, h) => drawChatScreen(c, w, h, chat, { unread, caret: runtime.textInput.caretOn && chat.active }), { unlit: true });
  // A rounded screen, its UVs spread over the whole print so the chat's hotspots line up
  {
    const sw = 0.87, sh = 1.87;
    const geo = new THREE.ShapeGeometry(runtime.core.roundedRectShape(sw, sh, 0.11), 10);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / sw + 0.5, pos.getY(i) / sh + 0.5);
    phoneScreen.geometry.dispose();
    phoneScreen.geometry = runtime.core.track(geo);
  }
  phoneScreen.position.z = 0.059;
  // the cover glass: two hard streaks of light over the screen, on the screen's own shape
  const glassTex = canvasTexture(256, 512);
  runtime.core.track(glassTex.texture);
  drawGlassSheen(glassTex.ctx, 256, 512, { strength: 0.16 });
  const phoneGlass = new THREE.Mesh(phoneScreen.geometry, runtime.core.track(new THREE.MeshBasicMaterial({ map: glassTex.texture, transparent: true, depthWrite: false })));
  phoneGlass.position.z = 0.0615;
  phoneGlass.raycast = runtime.core.noRaycast;
  // The chat's glow on the desk and the mug in front of it, at night
  const phoneLight = runtime.room.neonLight("#fff1dc", 0.5, () => runtime.core.roomLight.night, { distance: 1.6 });
  phoneLight.position.z = 0.35;
  phoneScreen.add(phoneLight);
  const phoneBezel = runtime.core.mesh(runtime.core.phoneSlab(0.91, 1.91, 0.02, 0.13), runtime.core.toon("#0d0d0f"), { outline: 0, cast: false });
  phoneBezel.position.z = 0.047;
  const phoneBody = runtime.core.mesh(runtime.core.phoneSlab(PHONE_W, PHONE_H, 0.09, 0.16), phoneFinish, { outline: 0.035 });
  // Side buttons: the action button and volume rocker on the left, the side button and Camera
  // Control on the right
  const sideButton = (x, y, h) => {
    const b = runtime.core.mesh(runtime.core.rbox(0.025, h, 0.04, 0.012), phoneTrim, { outline: 0.012 });
    b.position.set(x, y, 0);
    phone.add(b);
  };
  sideButton(-PHONE_W / 2 - 0.008, 0.62, 0.1);
  sideButton(-PHONE_W / 2 - 0.008, 0.42, 0.18);
  sideButton(-PHONE_W / 2 - 0.008, 0.18, 0.18);
  sideButton(PHONE_W / 2 + 0.008, 0.45, 0.26);
  sideButton(PHONE_W / 2 + 0.008, -0.25, 0.16);
  // The plateau runs edge to edge across the top of the back, a shade deeper than the body
  const plateau = runtime.core.mesh(runtime.core.phoneSlab(PHONE_W - 0.03, 0.56, 0.05, 0.13), phoneTrim, { outline: 0.025 });
  plateau.position.set(0, 0.66, -0.065);
  // Seen from the back the lenses sit on the left, which is +x here (the screen faces +z)
  const lensRing = runtime.core.toon("#4a131e");
  const lensGlass = runtime.core.toon("#16181d");
  [[0.25, 0.79], [0.25, 0.53], [0.05, 0.66]].forEach(([x, y]) => {
    const ring = runtime.core.mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.035, 28), lensRing, { outline: 0.015 });
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y, -0.1);
    const glass = runtime.core.mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.02, 24), lensGlass, { outline: 0 });
    glass.rotation.x = Math.PI / 2;
    glass.position.set(x, y, -0.112);
    const glint = new THREE.Mesh(runtime.core.track(new THREE.CircleGeometry(0.018, 12)), runtime.core.track(new THREE.MeshBasicMaterial({ color: "#5a6b8c" })));
    glint.rotation.y = Math.PI;
    glint.position.set(x - 0.02, y + 0.02, -0.123);
    glint.raycast = runtime.core.noRaycast;
    phone.add(ring, glass, glint);
  });
  const camFlash = runtime.core.mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16), runtime.core.toon("#fff3d6"), { outline: 0.006 });
  camFlash.rotation.x = Math.PI / 2;
  camFlash.position.set(-0.3, 0.79, -0.095);
  const lidar = runtime.core.mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), lensGlass, { outline: 0.006 });
  lidar.rotation.x = Math.PI / 2;
  lidar.position.set(-0.3, 0.53, -0.095);
  // the logo, a plain round mark like the monitor's
  const backLogo = new THREE.Mesh(runtime.core.track(new THREE.CircleGeometry(0.07, 24)), phoneTrim);
  backLogo.rotation.y = Math.PI;
  backLogo.position.set(0, -0.1, -0.047);
  backLogo.raycast = runtime.core.noRaycast;
  phone.add(phoneBody, phoneBezel, phoneScreen, phoneGlass, plateau, camFlash, lidar, backLogo);
  phoneStand.add(standBase, standBack, phone);
  const redrawChat = () => phoneScreen.userData.tex.redraw();
  function editChat() {
    chat.active = true;
    runtime.textInput.startTyping({
      id: "input",
      get: () => chat.input,
      set: (value) => (chat.input = value.replace(/\n/g, " ")),
      maxLength: 300,
      redraw: redrawChat,
      onEnter: () => sendChat(),
      onStop: () => (chat.active = false),
    });
  }
  async function sendChat(text = chat.input) {
    text = text.trim();
    if (!text || chat.waiting) return;
    const history = toHistory(chat.messages);
    chat.messages.push({ sender: "user", text });
    chat.input = "";
    runtime.textInput.typer.value = "";
    const reply = { sender: "bot", text: "", pending: true };
    chat.messages.push(reply);
    chat.waiting = true;
    chat.scroll = 0;
    redrawChat();
    sfx.pop({ pitch: 1.2 });
    try {
      // The signature lets the answer go back to the API as context for the next question
      ({ signature: reply.signature } = await getStreamingResponse(text, (token) => {
        reply.text += token;
        chatDirty = true;
      }, history));
      sfx.pop();
    } catch (error) {
      reply.text = chatErrorReply(error);
      sfx.buzz();
    }
    if (runtime.core.destroyed) return;
    reply.pending = false;
    chat.waiting = false;
    chatDirty = true;
  }
  // Unread message: the phone buzzes now and then until you pick it up
  const buzz = () => {
    if (!unread || runtime.camera.focus.name !== "overview") return;
    gsap.fromTo(phone.rotation, { z: 0.06 }, { z: 0, duration: 0.5, ease: "elastic.out(1.4, 0.2)", overwrite: "auto" });
  };
  const buzzTimer = setInterval(buzz, 4000);
  runtime.core.register(phoneStand, {
    focus: "chat",
    onHover: (on) => {
      if (runtime.camera.focus.name === "chat") return;
      gsap.to(phone.rotation, { x: on ? -0.2 : -0.28, z: 0, duration: 0.25, overwrite: true });
      if (!on) return;
      buzz();
      hoverSound(phoneStand, (s) => s.pop({ pitch: 1.5 }));
    },
    // Arrival: the phone hops, the unread badge clears and the chat box takes the keyboard
    onArrive: () => {
      gsap.killTweensOf(phone.rotation);
      phone.rotation.set(-0.28, 0, 0);
      gsap.fromTo(phone.position, { y: 1.26 }, { y: 1.12, duration: 0.4, ease: "bounce.out" });
      unread = false;
      sfx.ping();
      editChat();
    },
    onClick: editChat,
    onHotspot: (hs) => {
      if (hs.id === "send") sendChat();
      else if (hs.id === "ask") sendChat(hs.text);
      else editChat();
    },
  });
  const onWheel = (e) => {
    runtime.core.responsiveUntil = performance.now() + 2000;
    if (runtime.camera.focus.name === "shelf") {
      e.preventDefault();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? runtime.options.container.clientHeight : 1);
      runtime.pointer.browseShelf(runtime.shelf.shelfLook - delta * 0.0035);
      return;
    }
    if (runtime.camera.focus.name !== "chat" || !chat.maxScroll) return;
    e.preventDefault();
    chat.scroll = Math.max(0, Math.min(chat.maxScroll, chat.scroll - e.deltaY));
    redrawChat();
  };
  runtime.core.renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

  // Public state used by the other scene parts.
  return {
    setPhoneFinish,
    phoneStand,
    phoneScreen,
    chat,
    get chatTypingAt() { return chatTypingAt; },
    set chatTypingAt(value) { chatTypingAt = value; },
    get chatDirty() { return chatDirty; },
    set chatDirty(value) { chatDirty = value; },
    redrawChat,
    buzzTimer,
    onWheel,
  };
}
