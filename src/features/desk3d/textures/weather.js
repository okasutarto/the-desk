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

