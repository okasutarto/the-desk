import gsap from "gsap";
import { weatherKind } from "../textures";

export function createWeather(runtime) {
  // ---------- the real weather, for the rain outside and the Times Gate ----------
  // Today's real weather where the visitor is, from Open-Meteo (free, no key). Without asking
  // for their location, the place is read off their browser's time zone (Asia/Jakarta is
  // Jakarta) and found with Open-Meteo's geocoder; when that can't be read, it's Pontianak,
  // where Oka lives. Fetched as the room opens and at most every 15 minutes after. In "auto"
  // it rains outside the window when it's really raining there; "clear" and "rain" hold it.
  const HOME = { name: "Pontianak", lat: -0.0263, lon: 109.3425, tz: "Asia/Pontianak" };
  let placeFound = null;
  const findPlace = () => placeFound || (placeFound = (async () => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const city = tz.includes("/") && !tz.startsWith("Etc/") ? tz.split("/").pop().replace(/_/g, " ") : "";
    if (!city) return HOME;
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
      const hit = res.ok ? (await res.json()).results?.[0] : null;
      return hit ? { name: hit.name, lat: hit.latitude, lon: hit.longitude, tz } : HOME;
    } catch {
      return HOME;
    }
  })());
  const forecastUrl = (place) => `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}`
    + "&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day"
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
    + `&timezone=${encodeURIComponent(place.tz)}&forecast_days=4`;
  let place = null;
  let rainMode = runtime.options.rain;
  // how hard it's really raining there, 0 when dry, once a forecast is in
  let realRain = null;
  let weatherNow = null;
  let weatherFetchedAt = 0;
  let weatherLoading = false;
  async function loadWeather() {
    if (weatherLoading || (weatherNow && !weatherNow.error && performance.now() - weatherFetchedAt < 15 * 60000)) return;
    weatherLoading = true;
    try {
      place = await findPlace();
      const res = await fetch(forecastUrl(place));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { current, daily } = await res.json();
      if (runtime.core.destroyed) return;
      weatherNow = {
        current: { temp: current.temperature_2m, humidity: current.relative_humidity_2m, code: current.weather_code, wind: current.wind_speed_10m, isDay: current.is_day === 1 },
        days: daily.time.map((date, i) => ({
          label: i === 0 ? "Today" : new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
          code: daily.weather_code[i],
          max: daily.temperature_2m_max[i],
          min: daily.temperature_2m_min[i],
          rain: daily.precipitation_probability_max[i],
        })),
        updated: current.time.slice(11, 16),
      };
      weatherFetchedAt = performance.now();
      const kind = weatherKind(current.weather_code)[1];
      const raining = kind === "storm" ? 1 : kind === "rain" ? 0.7 : 0;
      // Only a change in the real weather moves the rain, so knocking on the window still
      // brings or stops a shower until then
      if (raining !== realRain) {
        realRain = raining;
        if (rainMode === "auto") showRain();
      }
    } catch {
      weatherNow = { error: true };
    } finally {
      weatherLoading = false;
    }
  }
  runtime.core.register(runtime.room.windowGroup, {
    focus: "window",
    onHover: (on) => {
      gsap.to(runtime.room.windowGlare.material, { opacity: on ? 1 : 0.55, duration: 0.35, overwrite: true });
      gsap.to(runtime.room.glareTex.texture.offset, { x: on ? -0.45 : 0, duration: on ? 0.65 : 0.4, ease: "power2.out", overwrite: true });
    },
    onArrive: () => {
      loadWeather();
      runtime.windowBlind.lookOut();
    },
    // Leaving the close-up shuts the window behind you
    onLeave: () => {
      if (runtime.windowLighting.isWindowOpen()) runtime.windowLighting.toggleWindow();
    },
    onClick: runtime.windowBlind.lookOut,
  });

  // The rain outside the window: the real weather's in "auto" (dry until it's known), or the
  // visitor's pick. A local rain preview holds whatever its link set.
  function showRain() {
    if (runtime.core.previewRain !== null) return;
    runtime.room.outside.rainTarget = rainMode === "rain" ? 0.8 : rainMode === "clear" ? 0 : realRain ?? 0;
  }
  function setRain(mode) {
    rainMode = mode === "clear" || mode === "rain" ? mode : "auto";
    showRain();
    if (rainMode === "auto") loadWeather();
  }
  setRain(rainMode);

  // Public state used by the other scene parts.
  return {
    refreshWeather: loadWeather,
    setRain,
    get weather() { return weatherNow; },
    get placeName() { return place?.name ?? ""; },
  };
}
