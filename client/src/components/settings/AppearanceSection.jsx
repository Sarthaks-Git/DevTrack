import SettingsSection from "./SettingsSection";
import ThemePicker from "../common/ThemePicker";

function AppearanceSection() {
  return (
    <SettingsSection number="09" label="Appearance" title="Theme" description="System follows your device's light or dark setting. Weather goes light on clear days and dark at night or when it's grey or wet. Saved in this browser.">
      <ThemePicker />
    </SettingsSection>
  );
}

export default AppearanceSection;
