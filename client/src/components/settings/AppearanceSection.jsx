import SettingsSection from "./SettingsSection";
import ThemePicker from "../common/ThemePicker";

function AppearanceSection() {
  return (
    <SettingsSection number="09" label="Appearance" title="Theme" description="System follows your device's light or dark setting and switches with it. Saved in this browser.">
      <ThemePicker />
    </SettingsSection>
  );
}

export default AppearanceSection;
