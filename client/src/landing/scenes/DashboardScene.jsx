import Scene from "../Scene";
import DashboardMock from "../mock/DashboardMock";

export default function DashboardScene() {
  return (
    <Scene id="dashboard" title="Know what to do next at a glance." visual={<DashboardMock />}>
      <p>
        The dashboard puts what is overdue or stalled first, then your week so far and what you did
        recently. No vanity numbers.
      </p>
    </Scene>
  );
}
