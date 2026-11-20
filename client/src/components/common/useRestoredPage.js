import { useEffect, useRef } from "react";

// Coming back with the Back button after leaving for another site (GitHub, Google, a bank page)
// restores this page from the browser's back/forward cache exactly as it was left, including any
// "Redirecting..." state. `onRestore` runs then, so buttons can be reset and data re-read.
export default function useRestoredPage(onRestore) {
  const latest = useRef(onRestore);

  useEffect(() => {
    latest.current = onRestore;
  });

  useEffect(() => {
    const handle = event => {
      if (event.persisted) latest.current?.();
    };
    window.addEventListener("pageshow", handle);
    return () => window.removeEventListener("pageshow", handle);
  }, []);
}
