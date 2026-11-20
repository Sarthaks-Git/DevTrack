import { useEffect, useState } from "react";
import { Notice } from "./SettingsSection";
import {
  currentSubscription, disablePush, enablePush, getPushStatus, needsHomeScreen, permission, pushSupported, removePushDevice, sendTestPush,
} from "../../services/pushService";

// Settings → Reminders: phone and browser notifications. One notification a morning with the
// number of new reminders; the text never names goals or projects, since it can show on a lock screen.
function PushPanel({ remindersOn }) {
  const [status, setStatus] = useState(null);
  const [thisDevice, setThisDevice] = useState(false);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState({ kind: "", text: "" });

  useEffect(() => {
    let active = true;
    Promise.all([getPushStatus(), currentSubscription().catch(() => null)])
      .then(([data, subscription]) => {
        if (!active) return;
        setStatus(data);
        setThisDevice(Boolean(subscription) && data.devices.length > 0);
      })
      .catch(() => active && setStatus(null));
    return () => {
      active = false;
    };
  }, []);

  async function run(action, work, success) {
    setBusy(action);
    setNotice({ kind: "", text: "" });
    try {
      await work();
      if (success) setNotice({ kind: "ok", text: success });
    } catch (error) {
      setNotice({ kind: "error", text: error.message || "Something went wrong. Try again." });
    } finally {
      setBusy("");
    }
  }

  if (!status?.available) return null;

  const supported = pushSupported();
  const blocked = permission() === "denied";

  return (
    <div className="border-t border-[var(--dt-border)] pt-5">
      <p className="text-sm font-medium text-[var(--dt-text-primary)]">Phone and browser notifications</p>
      <p className="mt-1 text-xs leading-5 text-[var(--dt-text-secondary)]">
        One notification around 8 am (India time) with the number of new reminders. It never shows goal or project names.
        Turn it on separately on each phone or browser. Signing out turns it off on that device.
      </p>

      {!supported ? (
        <p className="mt-3 text-xs leading-5 text-[var(--dt-text-muted)]">
          {needsHomeScreen()
            ? "On iPhone and iPad, first add DevTrack to your Home Screen (Share → Add to Home Screen), then open it from there and turn notifications on."
            : "This browser does not support notifications."}
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">
          {thisDevice ? (
            <>
              <button
                type="button"
                className="dt-link-button"
                disabled={Boolean(busy)}
                onClick={() => run("test", sendTestPush, "Test sent. It should appear in a few seconds.")}
              >
                {busy === "test" ? "Sending..." : "Send a test"}
              </button>
              <button
                type="button"
                className="dt-link-button"
                disabled={Boolean(busy)}
                onClick={() => run("off", async () => {
                  const data = await disablePush();
                  if (data) setStatus(data);
                  setThisDevice(false);
                }, "Notifications are off on this device.")}
              >
                {busy === "off" ? "Turning off..." : "Turn off on this device"}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="dt-link-button"
              disabled={Boolean(busy) || blocked || !remindersOn}
              onClick={() => run("on", async () => {
                setStatus(await enablePush(status.publicKey));
                setThisDevice(true);
              }, "Notifications are on for this device.")}
            >
              {busy === "on" ? "Turning on..." : "Turn on for this device"}
            </button>
          )}
        </div>
      )}

      {blocked ? (
        <p className="mt-3 text-xs leading-5 text-[var(--dt-text-muted)]">
          Notifications are blocked for this site. Allow them in your browser&apos;s site settings, then reload this page.
        </p>
      ) : null}
      {!remindersOn ? <p className="mt-3 text-xs text-[var(--dt-text-muted)]">Turn on reminders above to use notifications.</p> : null}

      {status.devices.length ? (
        <ul className="mt-4 space-y-2 text-xs text-[var(--dt-text-secondary)]" aria-label="Devices with notifications">
          {status.devices.map(device => (
            <li key={device.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {device.label}
                <span className="text-[var(--dt-text-muted)]"> · added {new Date(device.addedAt).toLocaleDateString()}</span>
              </span>
              <button
                type="button"
                className="dt-link-button"
                disabled={Boolean(busy)}
                onClick={() => run(`remove-${device.id}`, async () => {
                  const data = await removePushDevice(device.id);
                  setStatus(data);
                  if (!data.devices.length) setThisDevice(false);
                }, "Device removed.")}
              >
                {busy === `remove-${device.id}` ? "Removing..." : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <Notice kind={notice.kind}>{notice.text}</Notice>
    </div>
  );
}

export default PushPanel;
