import { useEffect, useState } from "react";

// Current time, refreshed at the start of every minute (the UI never shows seconds).
export function useNow() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let interval;
    const tick = () => setNow(new Date());
    const timeout = setTimeout(() => {
      tick();
      interval = setInterval(tick, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  return now;
}
