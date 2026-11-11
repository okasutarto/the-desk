<template>
  <div>
    <div class="desk-page fixed inset-0 overflow-hidden select-none">
      <div ref="stageRef" class="absolute inset-0"></div>

      <!-- Top-left: title + way out -->
      <!-- (kept back while the room waits in the dark behind the loader) -->
      <div class="hud-corner absolute top-4 left-4 flex flex-col items-start gap-2 pointer-events-none" :class="{ 'hud-corner--waiting': !inRoom }">
        <div class="pointer-events-auto bg-primary border-4 border-black shadow-neo px-3 py-1.5 -rotate-2">
          <h1 class="font-display font-extrabold text-black text-lg md:text-2xl leading-none">THE DESK</h1>
        </div>
        <div class="pointer-events-auto flex gap-2 mt-1">
          <!-- Sound lives on the desk, in the speakers; the time of day in the settings -->
          <router-link to="/2d" class="hud-btn bg-white text-black">← 2D site</router-link>
          <button
            class="hud-btn text-black px-2"
            :class="settingsOpen ? 'settings-toggle--open' : 'bg-white'"
            :aria-expanded="settingsOpen"
            aria-controls="room-settings"
            aria-label="Room settings"
            :title="settingsOpen ? 'Close room settings' : 'Room settings'"
            @click="settingsOpen = !settingsOpen">
            <svg viewBox="0 0 24 24" class="settings-gear w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          <!-- On a phone the way back out sits beside it, not in a third row over the view -->
          <transition name="hud-pop">
            <button v-if="zoomed && !isDesktop" class="hud-btn bg-primary text-black" @click="scene?.back()">← Back</button>
          </transition>
        </div>
        <!-- Room settings: the wall's paint, and the wood and cut of the desk, the monitor riser,
             the window frame and the game shelf. Its close button, the gear or Esc puts it away. -->
        <transition name="hud-pop">
          <div
            v-if="settingsOpen"
            id="room-settings"
            role="dialog"
            aria-label="Room settings"
            class="settings-panel pointer-events-auto w-[19.5rem] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-9rem)] flex flex-col">
            <header class="settings-head">
              <h2 class="font-display font-extrabold text-sm leading-none tracking-tight">ROOM SETTINGS</h2>
              <button class="settings-close" aria-label="Close room settings" title="Close" @click="settingsOpen = false">
                <svg viewBox="0 0 24 24" class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="square" aria-hidden="true">
                  <path d="M5 5l14 14M19 5L5 19" />
                </svg>
              </button>
            </header>
            <div class="settings-body overflow-y-auto flex flex-col gap-2.5 p-3">
              <!-- One group open at a time keeps the panel short. -->
              <section v-for="group in SETTINGS_GROUPS" :key="group.key" class="settings-card" :class="{ 'settings-card--open': openGroup === group.key }">
                <button
                  class="settings-group-head"
                  :aria-expanded="openGroup === group.key"
                  :aria-controls="`settings-${group.key}`"
                  @click="openGroup = openGroup === group.key ? null : group.key">
                  <span class="settings-tag" :style="{ background: group.accent }" aria-hidden="true">{{ group.icon }}</span>
                  <span class="whitespace-nowrap">{{ group.label }}</span>
                  <span class="settings-value">· {{ groupSummary[group.key] }}</span>
                  <svg viewBox="0 0 24 24" class="settings-chevron" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="square" aria-hidden="true">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                <div v-show="openGroup === group.key" :id="`settings-${group.key}`" class="settings-group-body">
                  <template v-if="group.key === 'sky'">
                    <div class="settings-sub">
                      <h3 class="settings-sublabel">
                        Time of day
                        <span class="settings-value">· {{ settings.time === "auto" ? `your clock, ${DAY_PARTS[clockPart].toLowerCase()}` : TIME_MODES[settings.time] }}</span>
                      </h3>
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          v-for="(name, key) in TIME_MODES"
                          :key="key"
                          class="pattern-chip"
                          :class="{ 'pattern-chip--on': settings.time === key }"
                          :aria-pressed="settings.time === key"
                          @click="setTime(key)">
                          {{ name }}
                        </button>
                      </div>
                    </div>
                    <div class="settings-sub">
                      <h3 class="settings-sublabel">
                        Weather
                        <span class="settings-value">· {{ settings.rain === "auto" ? "your weather" : RAIN_MODES[settings.rain] }}</span>
                      </h3>
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          v-for="(name, key) in RAIN_MODES"
                          :key="key"
                          class="pattern-chip"
                          :class="{ 'pattern-chip--on': settings.rain === key }"
                          :aria-pressed="settings.rain === key"
                          @click="setRain(key)">
                          {{ name }}
                        </button>
                      </div>
                    </div>
                    <div class="settings-sub">
                      <h3 class="settings-sublabel">
                        Ambience
                        <span class="settings-value">· {{ settings.ambience ? "outside the window" : "off" }}</span>
                      </h3>
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          v-for="(name, key) in { on: 'On', off: 'Off' }"
                          :key="key"
                          class="pattern-chip"
                          :class="{ 'pattern-chip--on': settings.ambience === (key === 'on') }"
                          :aria-pressed="settings.ambience === (key === 'on')"
                          @click="setAmbience(key === 'on')">
                          {{ name }}
                        </button>
                      </div>
                    </div>
                  </template>
                  <div v-else-if="group.key === 'wall'" class="settings-sub">
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        v-for="(name, key) in WALL_PATTERNS"
                        :key="key"
                        class="pattern-chip"
                        :class="{ 'pattern-chip--on': settings.wallPattern === key }"
                        :aria-pressed="settings.wallPattern === key"
                        @click="setWallPattern(key)">
                        {{ name }}
                      </button>
                    </div>
                    <!-- Brick comes in its own clay and slats in the furniture's woods; the rest take the paint -->
                    <div v-if="settings.wallPattern === 'brick'" class="flex flex-wrap items-center gap-1.5 mt-2">
                      <button
                        v-for="(brick, key) in BRICKS"
                        :key="key"
                        class="swatch"
                        :class="{ 'swatch--on': settings.wallBrick === key }"
                        :style="{ background: brick.tones[0] }"
                        :title="brick.name"
                        :aria-label="`${brick.name} wall`"
                        :aria-pressed="settings.wallBrick === key"
                        @click="setWallBrick(key)">
                        <span v-if="settings.wallBrick === key" class="swatch-tick" :class="{ 'swatch-tick--light': isDarkColour(brick.tones[0]) }" aria-hidden="true">✓</span>
                      </button>
                    </div>
                    <div v-else-if="settings.wallPattern === 'slats'" class="flex flex-wrap items-center gap-1.5 mt-2">
                      <button
                        v-for="(wood, key) in WOODS"
                        :key="key"
                        class="swatch"
                        :class="{ 'swatch--on': settings.wallSlats === key }"
                        :style="{ background: wood.swatch }"
                        :title="wood.name"
                        :aria-label="`${wood.name} slats`"
                        :aria-pressed="settings.wallSlats === key"
                        @click="setWallSlats(key)">
                        <span v-if="settings.wallSlats === key" class="swatch-tick" :class="{ 'swatch-tick--light': isDarkColour(wood.swatch) }" aria-hidden="true">✓</span>
                      </button>
                    </div>
                    <div v-else class="flex flex-wrap items-center gap-1.5 mt-2">
                      <button
                        v-for="paint in WALL_PAINTS"
                        :key="paint.hex"
                        class="swatch"
                        :class="{ 'swatch--on': settings.wall === paint.hex }"
                        :style="{ background: paint.hex }"
                        :title="paint.name"
                        :aria-label="`${paint.name} wall`"
                        :aria-pressed="settings.wall === paint.hex"
                        @click="setWall(paint.hex)">
                        <span v-if="settings.wall === paint.hex" class="swatch-tick" :class="{ 'swatch-tick--light': isDarkColour(paint.hex) }" aria-hidden="true">✓</span>
                      </button>
                      <label class="swatch swatch--custom" :class="{ 'swatch--on': !wallIsPreset }" title="Any colour" aria-label="Pick any wall colour">
                        <input :value="settings.wall" type="color" class="absolute inset-0 opacity-0 cursor-pointer" @input="setWall($event.target.value)" />
                      </label>
                    </div>
                  </div>
                  <div v-else-if="group.key === 'floor'" class="settings-sub">
                    <div class="flex flex-wrap items-center gap-1.5">
                      <button
                        v-for="(wood, key) in WOODS"
                        :key="key"
                        class="swatch"
                        :class="{ 'swatch--on': settings.floor.wood === key }"
                        :style="{ background: wood.swatch }"
                        :title="wood.name"
                        :aria-label="`${wood.name} floor`"
                        :aria-pressed="settings.floor.wood === key"
                        @click="setFloor({ wood: key })">
                        <span v-if="settings.floor.wood === key" class="swatch-tick" :class="{ 'swatch-tick--light': isDarkColour(wood.swatch) }" aria-hidden="true">✓</span>
                      </button>
                    </div>
                    <div class="flex flex-wrap gap-1.5 mt-2">
                      <button
                        v-for="(name, key) in FLOOR_LAYOUTS"
                        :key="key"
                        class="pattern-chip"
                        :class="{ 'pattern-chip--on': settings.floor.layout === key }"
                        :aria-pressed="settings.floor.layout === key"
                        @click="setFloor({ layout: key })">
                        {{ name }}
                      </button>
                    </div>
                  </div>
                  <template v-else-if="group.key === 'blind'">
                    <div class="settings-sub">
                      <h3 class="settings-sublabel">
                        Print
                        <span class="settings-value">· {{ BLIND_PATTERNS[settings.blind.pattern] }}</span>
                      </h3>
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          v-for="(name, key) in BLIND_PATTERNS"
                          :key="key"
                          class="pattern-chip"
                          :class="{ 'pattern-chip--on': settings.blind.pattern === key }"
                          :aria-label="`Blind print: ${name}`"
                          :aria-pressed="settings.blind.pattern === key"
                          @click="setBlind({ pattern: key })">
                          {{ name }}
                        </button>
                      </div>
                    </div>
                    <div class="settings-sub">
                      <h3 class="settings-sublabel">
                        Colour
                        <span class="settings-value">· {{ blindColourName }}</span>
                      </h3>
                      <div class="flex flex-wrap items-center gap-1.5">
                        <button
                          v-for="coat in BLIND_COLOURS"
                          :key="coat.hex"
                          class="swatch"
                          :class="{ 'swatch--on': settings.blind.colour === coat.hex }"
                          :style="{ background: coat.hex }"
                          :title="coat.name"
                          :aria-label="`${coat.name} blind`"
                          :aria-pressed="settings.blind.colour === coat.hex"
                          @click="setBlind({ colour: coat.hex })">
                          <span v-if="settings.blind.colour === coat.hex" class="swatch-tick" :class="{ 'swatch-tick--light': isDarkColour(coat.hex) }" aria-hidden="true">✓</span>
                        </button>
                        <label class="swatch swatch--custom" :class="{ 'swatch--on': !blindIsPreset }" title="Any colour" aria-label="Pick any blind colour">
                          <input :value="settings.blind.colour" type="color" class="absolute inset-0 opacity-0 cursor-pointer" @input="setBlind({ colour: $event.target.value })" />
                        </label>
                      </div>
                    </div>
                  </template>
                  <template v-else-if="group.key === 'devices'">
                    <div v-for="(device, part) in DEVICE_FINISHES" :key="part" class="settings-sub">
                      <h3 class="settings-sublabel">{{ device.label }}</h3>
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          v-for="(finish, key) in device.finishes"
                          :key="key"
                          class="pattern-chip flex items-center gap-1.5"
                          :class="{ 'pattern-chip--on': settings.deviceFinishes[part] === key }"
                          :aria-label="`${device.label}: ${finish.name}`"
                          :aria-pressed="settings.deviceFinishes[part] === key"
                          @click="setDeviceFinish(part, key)">
                          <span class="inline-block w-3 h-3 rounded-full border border-black/30" :style="{ background: finish.shell }" aria-hidden="true"></span>
                          {{ finish.name }}
                        </button>
                      </div>
                    </div>
                    <div class="settings-sub">
                      <h3 class="settings-sublabel">Smart Pixel Art</h3>
                      <div class="flex flex-wrap gap-1.5">
                        <button
                          v-for="(finish, key) in TIMES_GATE_FINISHES"
                          :key="key"
                          class="pattern-chip flex items-center gap-1.5"
                          :class="{ 'pattern-chip--on': settings.timesGateFinish === key }"
                          :aria-label="`Smart Pixel Art: ${finish.name}`"
                          :aria-pressed="settings.timesGateFinish === key"
                          @click="setTimesGateFinish(key)">
                          <span class="inline-block w-3 h-3 rounded-full border border-black/30" :style="{ background: finish.shell }" aria-hidden="true"></span>
                          {{ finish.name }}
                        </button>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <div v-for="(label, part) in WOOD_TARGETS" :key="part" class="settings-sub">
                      <h3 class="settings-sublabel">
                        <span class="whitespace-nowrap">{{ label }}</span>
                        <span class="settings-value">· {{ woodLabel(part) }}</span>
                      </h3>
                      <!-- A painted frame is picked by its paint; the wood under it hardly shows -->
                      <div v-if="settings.woods[part].pattern === 'painted'" class="flex flex-wrap items-center gap-1.5">
                        <button
                          v-for="paint in FRAME_PAINTS"
                          :key="paint.hex"
                          class="swatch"
                          :class="{ 'swatch--on': settings.woods[part].paint === paint.hex }"
                          :style="{ background: paint.hex }"
                          :title="paint.name"
                          :aria-label="`${paint.name} ${label.toLowerCase()}`"
                          :aria-pressed="settings.woods[part].paint === paint.hex"
                          @click="setWood(part, { paint: paint.hex })">
                          <span v-if="settings.woods[part].paint === paint.hex" class="swatch-tick" :class="{ 'swatch-tick--light': isDarkColour(paint.hex) }" aria-hidden="true">✓</span>
                        </button>
                        <label class="swatch swatch--custom" :class="{ 'swatch--on': !FRAME_PAINTS.some((paint) => paint.hex === settings.woods[part].paint) }" title="Any colour" aria-label="Pick any frame colour">
                          <input :value="settings.woods[part].paint" type="color" class="absolute inset-0 opacity-0 cursor-pointer" @input="setWood(part, { paint: $event.target.value })" />
                        </label>
                      </div>
                      <div v-else class="flex flex-wrap items-center gap-1.5">
                        <button
                          v-for="(wood, key) in WOODS"
                          :key="key"
                          class="swatch"
                          :class="{ 'swatch--on': settings.woods[part].wood === key }"
                          :style="{ background: wood.swatch }"
                          :title="wood.name"
                          :aria-label="`${wood.name} ${label.toLowerCase()}`"
                          :aria-pressed="settings.woods[part].wood === key"
                          @click="setWood(part, { wood: key })">
                          <span v-if="settings.woods[part].wood === key" class="swatch-tick" :class="{ 'swatch-tick--light': isDarkColour(wood.swatch) }" aria-hidden="true">✓</span>
                        </button>
                      </div>
                      <div class="flex flex-wrap gap-1.5 mt-2">
                        <button
                          v-for="key in PART_PATTERNS[part]"
                          :key="key"
                          class="pattern-chip"
                          :class="{ 'pattern-chip--on': settings.woods[part].pattern === key }"
                          :aria-pressed="settings.woods[part].pattern === key"
                          @click="setWood(part, { pattern: key })">
                          {{ WOOD_PATTERNS[key] }}
                        </button>
                      </div>
                    </div>
                  </template>
                </div>
              </section>
            </div>
          </div>
        </transition>
      </div>

      <!-- Zoomed in: the way back out -->
      <transition name="hud-pop">
        <div v-if="zoomed && isDesktop" class="absolute top-4 left-1/2 -translate-x-1/2">
          <button class="hud-btn bg-primary text-black text-base" @click="scene?.back()">
            ← Back to desk
            <kbd class="ml-1 bg-black text-white px-1.5 text-[10px] leading-5">ESC</kbd>
          </button>
        </div>
      </transition>

      <!-- Top-right: a secret just found (the trophy on the shelf keeps the count) -->
      <transition name="hud-pop">
        <div
          v-if="secretToast"
          :key="secretToast.key"
          class="absolute top-4 right-4 md:top-6 md:right-6 z-50 pointer-events-auto cursor-pointer bg-[#ffdd00] border-3 md:border-4 border-black shadow-[6px_6px_0_0_#000000] p-2.5 md:p-3 flex items-center gap-3 select-none -rotate-1 max-w-[calc(100vw-2rem)] hover:scale-105 transition-transform"
          title="Click to dismiss"
          @click="secretToast = null">
          <div class="w-10 h-10 md:w-11 md:h-11 bg-black text-[#ffdd00] flex items-center justify-center border-2 border-black font-extrabold text-lg md:text-xl shadow-[2px_2px_0_0_#ff90e8] shrink-0">
            {{ secretToast.allDone ? '🏆' : '✦' }}
          </div>
          <div class="flex flex-col min-w-0 pr-1">
            <div class="flex items-center gap-2">
              <span class="text-[10px] md:text-xs font-black tracking-wider uppercase bg-black text-white px-1.5 py-0.5 leading-none">
                {{ secretToast.allDone ? 'ALL SECRETS FOUND!' : 'SECRET FOUND' }}
              </span>
              <span class="text-xs md:text-sm font-bold text-black font-mono">
                {{ secretToast.found }}/{{ secretToast.total }}
              </span>
            </div>
            <div class="text-xs md:text-sm font-extrabold text-black leading-tight mt-1 truncate">
              {{ secretToast.title }}
            </div>
          </div>
        </div>
      </transition>

      <!-- Bottom: monitor command chips, then the hint -->
      <div class="absolute bottom-6 inset-x-4 flex flex-col items-center gap-3 pointer-events-none">
        <transition name="hud-pop">
          <div v-if="focus === 'monitor' && !consoleOn" class="pointer-events-auto flex flex-wrap justify-center gap-2">
            <button
              v-for="cmd in COMMAND_CHIPS"
              :key="cmd"
              class="hud-btn bg-black text-[#8fd694] normal-case font-mono"
              @click="scene?.runCommand(cmd)">
              &gt; {{ cmd }}
            </button>
          </div>
        </transition>
        <transition name="hud-pop" mode="out-in">
          <div
            v-if="hint"
            :key="hint"
            class="bg-black text-white font-bold text-sm md:text-base px-4 py-2 border-4 border-black shadow-[5px_5px_0_0_#00e0c6] text-center">
            {{ hint }}
          </div>
        </transition>
      </div>

      <p v-if="unsupported" class="absolute inset-0 flex items-center justify-center p-6 text-center font-bold">
        WebGL isn't available here. <router-link to="/2d" class="underline ml-1">Use the 2D site →</router-link>
      </p>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useMediaQuery } from "@vueuse/core";
import { projects } from "@/data/projects";
import { experiences } from "@/data/experience";
import { useTheme } from "@/shared/composables/useTheme";
import { useSfx, initializeAudio, prepareAudio, sfx } from "@/shared/composables/useSfx";
import { hideBootLoader, showEnterGate, setBootProgress, bootLoaderShowing } from "@/shared/utils/bootLoader";
import { WOODS, WOOD_PATTERNS, PART_PATTERNS, WOOD_TARGETS, FLOOR_LAYOUTS, FRAME_PAINTS, BRICKS } from "@/features/desk3d/woods";
import { DAY_PARTS, TIME_MODES, RAIN_MODES, partOfDay, partFor } from "@/features/desk3d/daylight";

import { useDeskSettings, SETTINGS_GROUPS, WALL_PAINTS, WALL_PATTERNS } from "./composables/useDeskSettings";
import { BLIND_PATTERNS, BLIND_COLOURS } from "./blindFinishes";
import { DEVICE_FINISHES } from "./deviceFinishes";
import { TIMES_GATE_FINISHES } from "./timesGateFinishes";

const COMMAND_CHIPS = ["help", "whoami", "projects", "hobbies", "sudo hire oka"];
const SECRET_NAMES = {
  snap: "Infinity Gauntlet Snap",
  katana: "Katana Draw & Strike",
  rat: "Mouse Scamper",
  catKeys: "Cat on Keyboard",
  rain: "Window Rainstorm",
  star: "Night Shooting Star",
  lamp: "Bouncy Edison Lamp",
  painting: "Living Canvas Art",
  chair: "Desk Chair Spin",
  guitar: "Guitar Acoustic Strum",
  luffy: "Straw Hat Strike",
  clock: "Clock Time Rewind",
  butterfly: "Bonsai Bloom",
  lofi: "Lofi Beats on Monitor",
  badge: "Staff ID Badge Flip",
  gymPR: "10-Rep Dumbbell Workout",
  konami: "Konami Cheat Code",
  console: "Retro Handheld Console",
  robot: "Bit the Glitchy Robot",
  trash: "Paper Basketball Toss",
};

const stageRef = ref(null);
const scene = ref(null);
const unsupported = ref(false);
const focus = ref("overview");
const introPlaying = ref(true);
const projectOpen = ref(false);
const consoleOn = ref(false);
const secretToast = ref(null);
const settingsOpen = ref(false);
const openGroup = ref("sky");
const { settings, wallIsPreset, groupSummary, woodLabel, isDarkColour, setWall, setWallPattern, setWallBrick, setWallSlats, setWood, setFloor, setTime, setRain, setAmbience, setTimesGateFinish, setDeviceFinish, setBlind, blindIsPreset, blindColourName } = useDeskSettings(scene);
let secretTimer = null;
const zoomed = computed(() => focus.value !== "overview");
const isDesktop = useMediaQuery("(min-width: 768px)");
const { isDark, toggleTheme } = useTheme();
const { muted, toggleMute } = useSfx();


// The visitor's clock, as a part of the day, for the panel's "Auto" (checked each minute)
const clockPart = ref(partOfDay());
let clockTimer = null;
// Esc puts the settings away, as do their close button and the gear. It listens first (capture)
// and claims the key, so the same Esc doesn't also send the camera back
function closeSettingsOnEscape(e) {
  if (e.key !== "Escape" || !settingsOpen.value) return;
  settingsOpen.value = false;
  e.preventDefault();
}

const hint = computed(() => {
  if (introPlaying.value) return "";
  if (focus.value === "monitor" && consoleOn.value) return isDesktop.value ? "Arrows / WASD or the mouse to sail · Space for the Gatling · Q to quit" : "Drag anywhere, even down here, to sail · Tap the red button for the Gatling";
  if (focus.value === "monitor") return isDesktop.value ? "Type a command and hit Enter, or open Spotifree from the dock ♫" : "Tap a command, or the dock to open Spotifree ♫";
  if (focus.value === "keyboard") return isDesktop.value ? "1–5 jump to a section · T terminal · C chat · Esc back" : "Tap 1–5 to jump to a section · T terminal · C chat";
  if (focus.value === "window") return isDesktop.value ? "Click for birds (a shooting star at night). Three quick clicks bring the rain" : "Tap for birds or a shooting star. Three quick taps bring the rain";
  if (focus.value === "shelf") return isDesktop.value ? "Scroll / drag ↕ to explore · Click the console to play, controller for a cheat, trophy for secrets" : "Swipe ↕ to explore · Tap the console to play, controller for a cheat, trophy for secrets";
  if (focus.value === "timesgate") return `${isDesktop.value ? "Click" : "Tap"} the gate to pet Byte ♡ · live weather, GitHub, visitors and FPS`;
  if (focus.value === "family") return isDesktop.value ? "Our Little Family ♡ · Esc or Back to desk" : "Our Little Family ♡";
  if (focus.value === "swords") return isDesktop.value ? "Hover a sword to read about it · Click it to draw and strike" : "Tap a sword to draw and strike";
  if (focus.value === "mug") return `${isDesktop.value ? "Click" : "Tap"} the mug for a sip. Finish the cup for the night shift`;
  if (focus.value === "experience") return isDesktop.value ? "Click a pass to hold it up, again to flip it (← → to browse)" : "Tap a pass to hold it, tap again to flip it";
  if (focus.value === "projects" && projectOpen.value) return isDesktop.value ? "Click the pages to turn them (or ← →)" : "Tap the pages to turn them";
  if (focus.value === "projects") return isDesktop.value ? "Click a tab, scroll or press ↑ ↓ to flip through, the front file to pull it out" : "Tap a tab to flip through, the front file to pull it out";
  if (focus.value === "contact") return isDesktop.value ? "Write on the card (Tab moves along), then hit SEND POSTCARD" : "Tap the card to write, then tap SEND POSTCARD";
  if (focus.value === "chat") return isDesktop.value ? "Type a question and hit Enter (scroll to read back)" : "Tap a question or the box below to ask";
  if (focus.value === "hero") return isDesktop.value ? "Click the badge to flip it (links on the back). Drag the pin to move it" : "Tap the badge to flip it. Drag the pin to move it";
  if (focus.value === "about") return isDesktop.value ? "The guestbook: click SIGN THE BOOK to leave a note · Drag the papers around" : "The guestbook: tap SIGN THE BOOK to leave a note";
  // On a desktop the terminal's welcome already says to look around; on a phone it's too small to read
  return isDesktop.value ? "" : "Tap anything to take a closer look · Swipe to turn the room, pinch to zoom";
});

// Coming in is a gesture, so audio is unlocked in time for the computer's boot sound
const inRoom = ref(false);
function enterDesk() {
  if (inRoom.value) return;
  inRoom.value = true;
  void initializeAudio();
  scene.value?.enter();
  setTimeout(() => (introPlaying.value = false), 1600);
}

function onEvent(name, payload = {}) {
  // The room's first frame is drawn, then timed behind the loader (the last stretch of its bar;
  // see the scene's probe). Once ready the loader asks the visitor in, and the intro waits.
  // Without a loader (the desk was reached from another page) there's nothing to wait for.
  if (name === "drawn") bootLoaderShowing() ? setBootProgress(0.7) : enterDesk();
  else if (name === "shaders") setBootProgress(0.6 + 0.08 * payload.progress);
  else if (name === "loading") setBootProgress(0.7 + 0.3 * payload.progress);
  // With the loader up, the room goes dark behind it, close on the monitor, and the loader's
  // screen hands over to the monitor's
  else if (name === "ready") {
    // (opened now so the gesture coming in only has to resume it; see prepareAudio)
    prepareAudio();
    if (!bootLoaderShowing()) enterDesk();
    else scene.value.standby().then((screen) => showEnterGate(enterDesk, screen, () => scene.value?.landStandby()) || enterDesk());
  }
  // An empty coffee cup flips the desk to the night shift, or back to day
  else if (name === "nightShift" && payload.dark !== isDark.value) toggleTheme();
  else if (name === "toggleSound") toggleMute();
  else if (name === "projectOpen") projectOpen.value = payload.open;
  else if (name === "console") consoleOn.value = payload.on;
  else if (name === "secret") {
    const isAll = payload.found === payload.total;
    const title = payload.id ? (SECRET_NAMES[payload.id] || payload.id) : (isAll ? "Master of the Desk!" : "Keep exploring the room!");
    secretToast.value = {
      allDone: isAll,
      found: payload.found,
      total: payload.total,
      title,
      key: `${payload.id || 'secret'}-${payload.found}-${Date.now()}`,
    };
    clearTimeout(secretTimer);
    secretTimer = setTimeout(() => (secretToast.value = null), 4500);
  }
  else if (name === "focus") {
    focus.value = payload.name;
  }
}

watch(isDark, (dark) => scene.value?.setTheme(dark));
watch(muted, (value) => scene.value?.setMuted(value));

onMounted(async () => {
  window.addEventListener("keydown", closeSettingsOnEscape, true);
  clockTimer = setInterval(() => (clockPart.value = partOfDay()), 60000);
  // The room opens on the visitor's part of the day (or their pick), so the page takes the night
  // theme for a night and the day theme otherwise before the scene is built
  if ((partFor(settings.time) === "night") !== isDark.value) toggleTheme();
  setBootProgress(0.12);
  try {
    const { createDeskScene } = await import("@/features/desk3d/deskScene");
    setBootProgress(0.35);
    await nextTick();
    // let the bar's move start before building the room holds up the page (a background tab
    // gets no frames, so it doesn't wait for one)
    await new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve));
      setTimeout(resolve, 100);
    });
    if (!stageRef.value) return;
    scene.value = createDeskScene({
      container: stageRef.value,
      projects,
      experiences,
      dark: isDark.value,
      muted: muted.value,
      wallColor: settings.wall,
      wallPattern: { pattern: settings.wallPattern, brick: settings.wallBrick, wood: settings.wallSlats },
      woods: JSON.parse(JSON.stringify(settings.woods)),
      floor: { ...settings.floor },
      timesGateFinish: settings.timesGateFinish,
      deviceFinishes: { ...settings.deviceFinishes },
      blind: { ...settings.blind },
      time: settings.time,
      rain: settings.rain,
      ambience: settings.ambience,
      onEvent,
    });
    setBootProgress(0.6);
    if (process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("preview") === "secret") {
      secretTimer = setTimeout(async () => {
        await initializeAudio();
        if (!stageRef.value) return;
        sfx.ding({ pitch: 1.15, volume: 0.22 });
        onEvent("secret", { id: "snap", found: 1, total: Object.keys(SECRET_NAMES).length });
      }, 2200);
    }
  } catch (err) {
    console.error(err);
    unsupported.value = true;
    hideBootLoader();
  }
});

onUnmounted(() => {
  clearInterval(clockTimer);
  window.removeEventListener("keydown", closeSettingsOnEscape, true);
  clearTimeout(secretTimer);
  hideBootLoader();
  scene.value?.destroy();
});
</script>

<style scoped>
.desk-page {
  z-index: 20;
  /* The boot loader's colour: it fades straight from the loader to the room */
  background: #1a1714;
}
.hud-corner {
  transition: opacity 0.5s ease-out 0.6s;
}
.hud-corner--waiting {
  opacity: 0;
  visibility: hidden;
}
.hud-btn {
  @apply inline-flex items-center gap-1 border-3 border-black px-3 py-1.5 text-xs md:text-sm font-bold uppercase shadow-neo-sm transition-transform;
}
.hud-btn:hover {
  transform: translate(-2px, -2px);
  box-shadow: 5px 5px 0 0 #000;
}
.hud-btn:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
/* The settings toggle: pink and pressed in while the panel is open, its gear turned a notch */
.settings-toggle--open {
  background: #ff90e8;
  transform: translate(2px, 2px);
  box-shadow: 1px 1px 0 0 #000;
}
.settings-toggle--open:hover {
  transform: translate(1px, 1px);
  box-shadow: 2px 2px 0 0 #000;
}
.settings-gear {
  transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
.settings-toggle--open .settings-gear {
  transform: rotate(90deg);
}
/* The panel: a card with a yellow title strip, each part on its own little card */
.settings-panel {
  @apply bg-white text-black border-4 border-black;
  box-shadow: 6px 6px 0 0 #000;
}
.settings-head {
  @apply flex items-center justify-between gap-2 px-3 py-2 border-b-4 border-black bg-primary shrink-0;
  background-image: radial-gradient(rgba(0, 0, 0, 0.14) 1px, transparent 1.2px);
  background-size: 6px 6px;
}
.settings-close {
  @apply w-7 h-7 flex items-center justify-center bg-white border-2 border-black transition-transform;
  box-shadow: 2px 2px 0 0 #000;
}
.settings-close:hover {
  @apply bg-black text-white;
  transform: translate(-1px, -1px) rotate(90deg);
  box-shadow: 3px 3px 0 0 #000;
}
.settings-close:active {
  transform: translate(2px, 2px);
  box-shadow: none;
}
.settings-body {
  background-color: #f6f3ec;
  background-image: radial-gradient(rgba(0, 0, 0, 0.09) 1px, transparent 1.2px);
  background-size: 10px 10px;
}
.settings-card {
  @apply bg-white border-2 border-black;
  box-shadow: 3px 3px 0 0 #000;
}
.settings-group-head {
  @apply w-full flex items-center gap-1.5 px-2.5 py-2 text-left text-xs font-extrabold uppercase tracking-wide min-w-0;
}
.settings-group-head:hover {
  background: #fff7c2;
}
.settings-card--open .settings-group-head {
  @apply border-b-2 border-black;
  background: #fff7c2;
}
.settings-chevron {
  @apply w-3.5 h-3.5 ml-auto shrink-0;
  transition: transform 0.2s;
}
.settings-card--open .settings-chevron {
  transform: rotate(180deg);
}
.settings-group-body {
  @apply px-2.5 pb-2.5;
}
.settings-sub {
  @apply pt-2.5;
}
.settings-sub + .settings-sub {
  @apply mt-2.5 border-t-2 border-dashed border-black/25;
}
.settings-sublabel {
  @apply flex items-center gap-1 text-[11px] font-extrabold uppercase mb-1.5 tracking-wide min-w-0;
}
.settings-tag {
  @apply inline-flex items-center justify-center w-5 h-5 border-2 border-black text-[11px] leading-none shrink-0;
  box-shadow: 1px 1px 0 0 #000;
}
.settings-value {
  @apply font-bold normal-case tracking-normal text-black/55 truncate min-w-0;
}
.swatch {
  @apply relative w-7 h-7 border-2 border-black flex items-center justify-center transition-transform;
  box-shadow: 2px 2px 0 0 #000;
}
.swatch:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 0 #000;
}
.swatch--on {
  transform: translate(1px, 1px);
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #000;
}
.swatch--on:hover {
  transform: translate(1px, 1px);
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #000;
}
.swatch-tick {
  @apply text-sm font-black leading-none text-black pointer-events-none;
}
.swatch-tick--light {
  @apply text-white;
}
.swatch--custom {
  background: conic-gradient(#ff90e8, #ffc900, #00e0c6, #90a8ed, #ff90e8);
}
.pattern-chip {
  @apply border-2 border-black px-1.5 py-0.5 text-[11px] font-bold bg-white transition-transform;
  box-shadow: 2px 2px 0 0 #000;
}
.pattern-chip:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 0 #000;
}
.pattern-chip--on,
.pattern-chip--on:hover {
  @apply bg-black text-white;
  transform: translate(2px, 2px);
  box-shadow: none;
}
.hud-pop-enter-active,
.hud-pop-leave-active {
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s;
}
.hud-pop-enter-from,
.hud-pop-leave-to {
  transform: scale(0.6) translateY(10px);
  opacity: 0;
}
</style>
