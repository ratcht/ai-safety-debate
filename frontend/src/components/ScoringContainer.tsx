import { useState } from 'react';
import type { DebateGroup, DebateScore, DebateResult } from '@/types/types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ScoringContainerProps {
  debate: DebateGroup;
  onScoreSubmit: (result: DebateResult) => void;
}

// Sortable item component
const SortableDebater = ({ id, index, isSubmitted }: { id: string; index: number; isSubmitted: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: isSubmitted });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="p-4 bg-gray-50 border rounded-lg flex items-center hover:bg-gray-100 transition-colors cursor-grab active:cursor-grabbing"
    >
      <span className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-4">
        {index + 1}
      </span>
      <span className="font-medium">
        Debater {id.split('_')[1]}
      </span>
    </div>
  );
};

export default function ScoringContainer({
  debate,
  onScoreSubmit,
}: ScoringContainerProps) {
  const [scores, setScores] = useState<DebateScore[]>(() =>
    debate.rounds[0].messages.map((_, index) => ({
      debaterId: `debater_${index + 1}`,
      ranking: index + 1,
      score: {
        reasoning: 5,
        evidence: 5,
        clarity: 5,
        persuasiveness: 5,
        honesty: 5,
        feedback: ''
      },
    }))
  );

  const [ranking, setRanking] = useState<string[]>(() =>
    scores.map(score => score.debaterId)
  );

  const [isVisible, setIsVisible] = useState<boolean>(true);

  const [judgeNotes, setJudgeNotes] = useState('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleScoreChange = (
    debaterId: string,
    category: keyof DebateScore['score'],
    value: number
  ) => {
    setScores(prev => prev.map(score =>
      score.debaterId === debaterId
        ? {
          ...score,
          score: {         // Changed from 'scores' to 'score'
            ...score.score,
            [category]: value
          }
        }
        : score
    ));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setRanking((items) => {
        const oldIndex = items.indexOf(active.id.toString());
        const newIndex = items.indexOf(over.id.toString());
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleLLMJudge = () => {
    fetch(`/api/debate/${debate.id.toString()}/judge/llm`)
      .then(response => response.json())
      .then(data => {
        console.log('LLM Judge Response:', data);
        // Handle the response data as needed
      })
      .catch(error => {
        console.error('Error fetching LLM judge response:', error);
      });

  }

  const handleSubmit = () => {
    const scoresWithRankings = scores.map(score => ({
      ...score,
      ranking: ranking.indexOf(score.debaterId) + 1
    }));

    // Extract messages grouped by debater
    const debaterMessages = debate.rounds.flatMap((round, roundIndex) =>
      round.messages.map((message, messageIndex) => ({
        round: roundIndex + 1,
        debaterId: `debater_${messageIndex + 1}`,
        response: message.response,
      }))
    );

    const result: DebateResult = {
      debateId: debate.id.toString(),
      topic: debate.userInput,
      timestamp: Date.now(),
      config: debate.config,
      scores: scoresWithRankings,
      messages: debaterMessages
    };

    onScoreSubmit(result);
    setIsVisible(false);
    setIsSubmitted(true);
  };

  const handleDownload = () => {
    const scoresWithRankings = scores.map(score => ({
      ...score,
      ranking: ranking.indexOf(score.debaterId) + 1
    }));
  
    // Extract messages grouped by debater
    const debaterMessages = debate.rounds.flatMap((round, roundIndex) =>
      round.messages.map((message, messageIndex) => ({
        round: roundIndex + 1,
        debaterId: `debater_${messageIndex + 1}`,
        response: message.response,
      }))
    );
  
    const result: DebateResult = {
      debateId: debate.id.toString(),
      topic: debate.userInput,
      timestamp: Date.now(),
      config: debate.config,
      scores: scoresWithRankings,
      messages: debaterMessages
    };
  
    // Convert result to JSON string with indentation for readability
    const jsonString = JSON.stringify(result, null, 2);
  
    // Create a Blob containing the JSON data
    const blob = new Blob([jsonString], { type: "application/json" });
  
    // Create a temporary link element
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `debate_results_${debate.id}.json`; // Naming format
  
    // Append to the document, trigger download, and remove the element
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isVisible) {
    return isSubmitted ? (
      <div className="mt-6 flex justify-between items-center bg-gray-50 p-4 rounded-lg">
        <span className="text-gray-600">Debate has been scored</span>
        <div className='flex flex-row gap-2'>
          <button
            onClick={handleDownload}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-white rounded-lg border"
          >
            Download Results
          </button>
          <button
            onClick={() => setIsVisible(!isVisible)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-white rounded-lg border"
          >
            View Scoring
          </button>
        </div>
      </div>
    ) : null;
  }

  return (
    <div className="mt-6 bg-white rounded-xl p-6 border border-gray-200 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Score Debate</h2>
          <div className="">
            {!isSubmitted ? (
            <button 
              onClick={handleLLMJudge}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-white rounded-lg border"
            >
              Judge with LLM
            </button>) : 
            
            (<div className='flex flex-row gap-2'>
              <button
              onClick={handleDownload}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-white rounded-lg border"
            >
              Download Results
            </button>

            <button
            onClick={() => setIsVisible(!isVisible)}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-white rounded-lg border"
            >
            Hide Scoring
            </button></div>)}
          </div>
      </div>

      {/* Drag and Drop Ranking */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Final Ranking</h3>
        <p className="text-sm text-gray-600">
          Drag and drop debaters to rank them from winner (top) to last place (bottom)
        </p>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={ranking}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {ranking.map((debaterId, index) => (
                <SortableDebater
                  key={debaterId}
                  id={debaterId}
                  index={index}
                  isSubmitted={isSubmitted}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Detailed Scoring */}
      <div className="space-y-8">
        {scores.map((score) => (
          <div key={score.debaterId} className="border-t pt-6">
            <h3 className="text-lg font-semibold mb-4">
              Debater {score.debaterId.split('_')[1]} Evaluation
            </h3>
            
            <div className="grid grid-cols-2 gap-6">
                {Object.entries(score.score).map(([category, value]) => (
                category !== 'feedback' && (
                  <div key={category}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                    {category} (1-10)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={value}
                    onChange={(e) => handleScoreChange(
                    score.debaterId,
                    category as keyof DebateScore['score'],
                    parseInt(e.target.value)
                    )}
                    disabled={isSubmitted}
                    className="w-full"
                  />
                  <span className="text-sm text-gray-500">{value}</span>
                  </div>
                )
                ))}
            </div>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Feedback
              </label>
              <textarea
                value={score.score.feedback}
                onChange={(e) => setScores(prev => prev.map(s =>
                  s.debaterId === score.debaterId
                    ? { 
                        ...s, 
                        score: {
                          ...s.score,
                          feedback: e.target.value
                        }
                      }
                    : s
                ))}
                disabled={isSubmitted}
                className="w-full px-3 py-2 border rounded-lg h-24 disabled:bg-gray-50"
                placeholder="Provide specific feedback for this debater..."
              />
            </div>
          </div>
        ))}
      </div>

      {/* Overall Debate Notes */}
      <div className="border-t pt-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Judge Notes
        </label>
        <textarea
          value={judgeNotes}
          onChange={(e) => setJudgeNotes(e.target.value)}
          disabled={isSubmitted}
          className="w-full px-3 py-2 border rounded-lg h-32 disabled:bg-gray-50"
          placeholder="Provide overall notes about the debate, key points, and decision rationale..."
        />
      </div>

      {/* Submit Button */}
      {!isSubmitted && (
        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Submit Evaluation
          </button>
        </div>
      )}
    </div>
  );
}