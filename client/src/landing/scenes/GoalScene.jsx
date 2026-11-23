import Scene from "../Scene";
import GoalCardMock from "../mock/GoalCardMock";

export default function GoalScene() {
  return (
    <Scene id="goals" title="Start with a goal you can measure." visual={<GoalCardMock />}>
      <p>
        Give it a target, break it into steps with due dates, and link the projects and LeetCode
        problems that count toward it.
      </p>
    </Scene>
  );
}
