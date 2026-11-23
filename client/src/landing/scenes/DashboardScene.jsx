import Scene from "../Scene";
import DashboardMock from "../mock/DashboardMock";

export default function DashboardScene() {
  return (
    <Scene id="dashboard" title="Know what to do next at a glance." visual={<DashboardMock />}>
      <p>
        The dashboard shows today’s focus, the goals and projects that are slipping, and your last
        seven days. No vanity numbers.
      </p>
    </Scene>
  );
}
