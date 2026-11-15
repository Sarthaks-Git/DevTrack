import { getDayPeriod } from "../../utils/dayPeriod";
import { useNow } from "../common/useNow";

// Follows the clock, so a dashboard left open rolls from afternoon into evening.
export function useDayPeriod() {
  return getDayPeriod(useNow());
}
