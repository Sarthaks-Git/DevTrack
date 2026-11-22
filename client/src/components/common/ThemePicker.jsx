import { useState } from "react";
import { useTheme } from "../../theme/theme";
import { refreshWeather, requestLocation } from "../../theme/weather";

const LABELS = { system: "System", light: "Light", dark: "Dark", weather: "Weather" };
const LOCATION_ERRORS = {
  unsupported: "This browser can't share a location, so Weather isn't available here.",
  denied: "Location is blocked for this site. Allow it in your browser's site settings, then choose Weather again.",
  failed: "Couldn't get your location. Try choosing Weather again.",
};

function WeatherStatus({ weather, fresh, resolved }) {
  const { result, status } = weather;
  let text;
  if (fresh && result) text = `Weather near you: ${result.condition}${result.isDay === false ? " at night" : ""}, so ${resolved}.`;
  else if (status === "loading" || status === "idle") text = "Checking the weather near you…";
  else text = `Weather is unavailable right now, so DevTrack is following your device (${resolved}).`;
  return (
    <div className="mt-2 space-y-1 text-xs text-[var(--dt-text-muted)]">
      <p role="status" aria-live="polite">{text}</p>
      <p>
        Uses your location rounded to about 11 km, kept in this browser and checked every 30 minutes. Weather data from{" "}
        <a href="https://www.met.no/en" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--dt-text-primary)]">MET Norway</a>.
      </p>
    </div>
  );
}

// System / Light / Dark / Weather switch. `compact` is the small version in the sidebar: it never asks
// for location (that needs the explanation in Settings), and shows Weather only while it is on.
function ThemePicker({ compact = false }) {
  const { preference, resolved, weather, weatherFresh, setPreference } = useTheme();
  const [asking, setAsking] = useState(false);
  const [locationError, setLocationError] = useState("");

  const options = Object.entries(LABELS).filter(([value]) => !compact || value !== "weather" || preference === "weather");

  const choose = async value => {
    setLocationError("");
    if (value !== "weather") {
      setPreference(value);
      return;
    }
    if (preference === "weather" || asking) return;
    setAsking(true);
    try {
      const location = await requestLocation();
      setPreference("weather");
      await refreshWeather({ force: true, location });
    } catch (error) {
      if (error?.message === "unsupported") setLocationError(LOCATION_ERRORS.unsupported);
      else setLocationError(error?.code === 1 ? LOCATION_ERRORS.denied : LOCATION_ERRORS.failed);
    } finally {
      setAsking(false);
    }
  };

  return (
    <div>
      <div role="radiogroup" aria-label="Theme" className="inline-flex flex-wrap border border-[var(--dt-border)]">
        {options.map(([value, label]) => {
          const selected = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-busy={value === "weather" && asking ? true : undefined}
              onClick={() => choose(value)}
              className={`${compact ? "px-2 py-1 text-[11px]" : "px-4 py-2 text-sm"} transition-colors ${selected ? "bg-[var(--dt-accent)] text-white" : "text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)]"}`}
            >
              {value === "weather" && asking ? "Asking…" : label}
            </button>
          );
        })}
      </div>
      {!compact && preference === "system" ? (
        <p className="mt-2 text-xs text-[var(--dt-text-muted)]">Following your device: {resolved} right now.</p>
      ) : null}
      {!compact && preference === "weather" ? <WeatherStatus weather={weather} fresh={weatherFresh} resolved={resolved} /> : null}
      {!compact && locationError ? <p role="alert" className="mt-2 text-xs text-red-300">{locationError}</p> : null}
    </div>
  );
}

export default ThemePicker;
