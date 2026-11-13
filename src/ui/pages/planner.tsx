/**
 * The Planner: your situation on the left, the comps and agents that fit it on the right. It
 * answers as you change things, and keeps the question for next time.
 */
import { useEffect } from 'preact/hooks';
import { PageHead } from '../shell.tsx';
import { Question } from '../planner/question.tsx';
import { Answers } from '../planner/answers.tsx';
import { answer, currentQuestion, question, run } from '../planner/store.ts';
import type { PageProps } from './index.ts';

export function PlannerPage(_p: PageProps) {
  const q = question.value ?? currentQuestion();
  // answer on arrival when there's no answer for this question yet
  useEffect(() => {
    if (!run.peek() || JSON.stringify(run.peek()!.query) !== JSON.stringify(q)) void answer();
  }, []);
  return (
    <>
      <PageHead title="Planner">Tell it your situation and it finds the comps that fit, with plays and tips for each.</PageHead>
      <div class="planner">
        <Question q={q} />
        <Answers />
      </div>
    </>
  );
}
