import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createGoalQuiz, getGoalQuiz, submitGoalQuiz } from "../../services/goalService";

const failureOf = failure => {
  const code = failure.response?.data?.code || failure.response?.data?.error?.code || "";
  // The API client turns every 429 into a generic text; the monthly AI limit deserves its own.
  const text = code === "AI_QUOTA_REACHED" ? "You have used this month's AI actions. They reset on the 1st." : failure.message;
  return { text, code };
};

const shortDate = value => new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function scheduleText(quiz) {
  if (quiz.mastered) return "Mastered: you passed every review.";
  if (!quiz.nextReviewAt) return "Pass with 4 out of 5 to start spaced reviews (after 3, 7 and 30 days).";
  if (quiz.due) return "A review is due now.";
  return `Next review ${shortDate(quiz.nextReviewAt)}. Reviews passed: ${Math.max(0, quiz.stage - 1)} of ${quiz.reviews}.`;
}

// AI mentor: a short self-check on a goal, retaken on a spaced schedule. A self-test, not verified progress.
function QuizModal({ goal, onClose }) {
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState("load");
  const [error, setError] = useState({ text: "", code: "" });

  useEffect(() => {
    if (!goal) return undefined;
    // Mounted fresh per goal (key in Goals.jsx), so state starts clean.
    let active = true;
    getGoalQuiz(goal._id)
      .then(data => {
        if (!active) return;
        setQuiz(data.quiz);
        setAnswers(data.quiz ? data.quiz.questions.map(() => null) : []);
      })
      .catch(failure => active && setError(failureOf(failure)))
      .finally(() => active && setBusy(""));
    return () => {
      active = false;
    };
  }, [goal]);

  useEffect(() => {
    if (!goal) return undefined;
    function handleKeyDown(event) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [goal, busy, onClose]);

  if (!goal) return null;

  async function create() {
    setBusy("create");
    setError({ text: "", code: "" });
    try {
      const data = await createGoalQuiz(goal._id);
      setQuiz(data.quiz);
      setAnswers(data.quiz.questions.map(() => null));
      setResult(null);
    } catch (failure) {
      setError(failureOf(failure));
    } finally {
      setBusy("");
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy("submit");
    setError({ text: "", code: "" });
    try {
      const data = await submitGoalQuiz(goal._id, answers);
      setResult(data);
      setQuiz(data.quiz);
    } catch (failure) {
      setError(failureOf(failure));
    } finally {
      setBusy("");
    }
  }

  function retake() {
    setResult(null);
    setAnswers(quiz.questions.map(() => null));
  }

  const needsSettings = ["AI_CONSENT_REQUIRED", "AI_QUOTA_REACHED", "AI_PLAN_REQUIRED"].includes(error.code);
  const answered = answers.filter(answer => answer !== null).length;
  const buttonClass = "px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-secondary)] hover:text-[var(--dt-text-primary)] disabled:opacity-40";
  const primaryClass = "border border-[var(--dt-accent)] px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-[var(--dt-text-primary)] hover:bg-[var(--dt-accent)]/10 disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="quiz-title">
      <form onSubmit={submit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border border-[var(--dt-border-strong)] bg-[var(--dt-surface)] p-6 shadow-2xl animate-[dt-modal-in_180ms_ease-out] md:p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--dt-text-muted)]">AI mentor · self-check</p>
        <h2 id="quiz-title" className="mt-3 font-[family-name:var(--dt-font-display)] text-2xl leading-tight text-[var(--dt-text-primary)] md:text-3xl">Quiz yourself</h2>
        <p className="mt-2 break-words text-sm text-[var(--dt-text-secondary)]">{goal.title}</p>

        {busy === "load" ? <p className="mt-5 text-sm text-[var(--dt-text-muted)]">Loading...</p> : null}

        {!quiz && busy !== "load" ? (
          <p className="mt-5 text-sm leading-6 text-[var(--dt-text-secondary)]">
            Get 5 multiple-choice questions on this goal. Pass with 4 out of 5, then come back after 3, 7 and 30 days to make it
            stick; you'll get a reminder when a review is due. Uses 1 AI action. This is a self-check and does not count as verified progress.
          </p>
        ) : null}

        {quiz ? (
          <>
            <p className="mt-4 text-xs text-[var(--dt-text-muted)]">{scheduleText(quiz)}</p>
            {result ? (
              <p role="status" className="mt-4 text-sm text-[var(--dt-text-primary)]">
                You got {result.score} of {result.total}. {result.passed ? "Passed." : "Not passed yet. Read the explanations and try again tomorrow."}
              </p>
            ) : null}
            <ol className="mt-5 space-y-6">
              {quiz.questions.map((question, index) => {
                const outcome = result?.results[index];
                return (
                  <li key={index}>
                    <fieldset disabled={Boolean(busy) || Boolean(result)}>
                      <legend className="text-sm font-medium leading-6 text-[var(--dt-text-primary)]">{index + 1}. {question.prompt}</legend>
                      <div className="mt-2 space-y-2">
                        {question.options.map((option, optionIndex) => {
                          const isAnswer = outcome && optionIndex === outcome.answer;
                          const isWrongPick = outcome && optionIndex === outcome.chosen && !outcome.correct;
                          return (
                            <label
                              key={optionIndex}
                              className={`flex items-start gap-3 border px-3 py-2 text-sm text-[var(--dt-text-secondary)] ${isAnswer ? "border-[var(--dt-verified-border)]" : isWrongPick ? "border-red-400/60" : "border-[var(--dt-border)]"}`}
                            >
                              <input
                                type="radio"
                                name={`question-${index}`}
                                className="mt-1"
                                checked={answers[index] === optionIndex}
                                onChange={() => setAnswers(list => list.map((value, i) => (i === index ? optionIndex : value)))}
                              />
                              <span className="break-words">
                                {option}
                                {isAnswer ? <span className="ml-2 text-xs text-[var(--dt-verified)]">Correct answer</span> : null}
                                {isWrongPick ? <span className="ml-2 text-xs text-red-300">Your answer</span> : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                    {outcome?.explanation ? <p className="mt-2 text-xs leading-5 text-[var(--dt-text-muted)]">{outcome.explanation}</p> : null}
                  </li>
                );
              })}
            </ol>
          </>
        ) : null}

        {error.text ? (
          <p role="alert" className="mt-5 text-sm text-red-300">
            {error.text}{" "}
            {needsSettings ? <Link to="/app/settings#ai" className="underline underline-offset-2">Open AI settings</Link> : null}
          </p>
        ) : null}

        <div className="mt-8 flex flex-col-reverse flex-wrap gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={Boolean(busy) && busy !== "load"} className={buttonClass}>Close</button>
          {busy !== "load" && (!quiz || result) ? (
            <button type="button" onClick={create} disabled={Boolean(busy)} className={quiz ? buttonClass : primaryClass}>
              {busy === "create" ? "Writing questions..." : quiz ? "New questions" : "Create quiz"}
            </button>
          ) : null}
          {quiz && result ? <button type="button" onClick={retake} className={primaryClass}>Retake</button> : null}
          {quiz && !result ? (
            <button type="submit" disabled={Boolean(busy) || answered === 0} className={primaryClass}>
              {busy === "submit" ? "Checking..." : `Check answers (${answered}/${quiz.questions.length})`}
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}

export default QuizModal;
