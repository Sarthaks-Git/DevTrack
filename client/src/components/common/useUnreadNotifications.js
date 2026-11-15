import { useCallback, useEffect, useState } from "react";
import { getUnreadCount } from "../../services/notificationService";

const POLL_MS = 2 * 60 * 1000;

// Unread reminder count for the bell. Polls gently, refreshes when the tab regains focus,
// and pauses while the tab is hidden. The server throttles reminder generation itself.
export function useUnreadNotifications() {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(() => {
    getUnreadCount().then(setUnread).catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  return { unread, setUnread, refresh };
}
