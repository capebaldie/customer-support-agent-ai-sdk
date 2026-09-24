export function FollowUpSuggestions({
  questions,
  onSelect,
}: {
  questions: string[];
  onSelect: (question: string) => void;
}) {
  if (questions.length === 0) return null;

  return (
    <div className="mt-5">
      <p className="text-xs text-depth mb-2">Follow-up questions</p>
      <div className="flex flex-wrap gap-2">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            onClick={() => onSelect(question)}
            className="rounded-xl border border-rule px-3 py-1.5 text-sm text-left transition-all duration-200 hover:border-edge hover:shadow-sm hover:-translate-y-px"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
