import Scene from "../Scene";
import JournalMock from "../mock/JournalMock";

export default function JournalScene() {
  return (
    <Scene id="journal" title="Keep notes that become a record." visual={<JournalMock />} flip>
      <p>
        Write down what you learned or what blocked you. Entries sit on a timeline next to your
        solved problems, commits and finished steps.
      </p>
    </Scene>
  );
}
