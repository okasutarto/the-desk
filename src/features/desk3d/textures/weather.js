// ---------- the weather's kind, for the Times Gate's weather screen ----------
// WMO weather codes, as Open-Meteo reports them, to a label and an icon kind
export function weatherKind(code) {
  if (code === 0) return ["Clear", "clear"];
  if (code <= 2) return ["Partly cloudy", "partly"];
  if (code === 3) return ["Overcast", "cloudy"];
  if (code === 45 || code === 48) return ["Fog", "fog"];
  if (code >= 51 && code <= 57) return ["Drizzle", "rain"];
  if (code >= 61 && code <= 67) return ["Rain", "rain"];
  if (code >= 71 && code <= 77) return ["Snow", "snow"];
  if (code >= 80 && code <= 82) return ["Showers", "rain"];
  if (code >= 85 && code <= 86) return ["Snow showers", "snow"];
  if (code >= 95) return ["Thunderstorm", "storm"];
  return ["—", "cloudy"];
}


// How hard it rains outside the window for a WMO weather code (0 dry, 1 the heaviest storm).
// The codes carry their own intensity (light, moderate, dense or heavy), so a thin drizzle
// hisses softly and greys the sky a little, and a downpour drums on the glass. Only storms
// reach the ambience's thunder (0.85 and up); snow falls quietly, so it's dry here.
const RAIN_BY_CODE = {
  51: 0.25, 53: 0.32, 55: 0.4, // drizzle: light, moderate, dense
  56: 0.3, 57: 0.42, // freezing drizzle
  61: 0.4, 63: 0.6, 65: 0.8, // rain: slight, moderate, heavy
  66: 0.45, 67: 0.75, // freezing rain
  80: 0.45, 81: 0.65, 82: 0.8, // showers: slight, moderate, violent
  95: 0.9, 96: 1, 99: 1, // thunderstorm, with slight or heavy hail
};
export const rainForCode = (code) => RAIN_BY_CODE[code] ?? 0;
