import Scene from "../Scene";
import GoalCardMock from "../mock/GoalCardMock";

export default function GoalScene() {
  return (
    <Scene id="goals" title="Start with a goal you can measure." visual={<GoalCardMock />}>
      <p>
        Give it a LeetCode target, break it into milestones with due dates, and link the projects
        that count toward it.
      </p>
    </Scene>
  );
}
