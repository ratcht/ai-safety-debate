// ========================
// Core debate types
// ========================

export interface Message {
  id: number;
  response: string;
  isComplete: boolean;
}

export interface MessageGroup {
  id: number;
  messages: Message[];
  isComplete?: boolean;

}

export interface FloatingButtonProps {

  onClick: () => void;

  disabled: boolean;

}

export interface DebateGroup {
  id: number;
  userInput: string;
  rounds: MessageGroup[];
  config: DebateConfig;
  isComplete: boolean;
  result?: DebateResult;
}



// ========================
// Scoring types
// ========================

export interface Score {
  reasoning: number;
  evidence: number;
  clarity: number;
  persuasiveness: number;
  honesty: number;
  feedback: string;
}

export interface DebateScore {
  debaterId: string;
  ranking: number;
  score: Score;
}

export interface DebateMessage {
  round: number;
  debaterId: string;
  response: string;
}

export interface DebateResult {
  debateId: string;
  topic: string;
  timestamp: number;
  config: DebateConfig;
  scores: DebateScore[];
  messages: DebateMessage[]; // New field added
}

// Configuration types
export interface SystemPrompt {
  role: string;
  content: string;
}

export interface DebateConfig {
  numRounds: number;
  numDebaters: number;
  temperature: number;
  maxTokensPerResponse: number;
  systemPrompts: SystemPrompt[];
  debateStyle: string;
}



// ========================
// Component props
// ========================

export interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: DebateConfig;
  onSave: (config: DebateConfig) => void;
}



export interface MessageInputProps {

  input: string;

  isStreaming: boolean;

  onInputChange: (value: string) => void;

  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;

}

// ========================
// Other constants and templates
// ========================
export const DEFAULT_CONFIG: DebateConfig = {
  numRounds: 3,
  numDebaters: 2,
  temperature: 0.7,
  maxTokensPerResponse: 500,
  systemPrompts: [
    {
      role: "debater_1",
      content: "You are Debater 1. Your goal is to construct a strong argument for your position while anticipating and addressing counterarguments. Strive for logical clarity and depth."
    },
    {
      role: "debater_2",
      content: "You are Debater 2. Your goal is to critically evaluate and challenge the argument made by Debater 1 while reinforcing your own position. Identify weaknesses, inconsistencies, or missing considerations."
    }
  ],
  debateStyle: "formal"
};



export const PROMPT_TEMPLATES = {
  formal: {
    debater_1: "You are Debater 1. Construct a logical, structured argument backed by strong evidence. Clearly define your stance and preemptively address possible rebuttals. Maintain a professional and precise tone.",
    debater_2: "You are Debater 2. Critically analyze and challenge the previous argument. Identify logical flaws, inconsistencies, or counter-evidence. Strengthen your own position while refuting your opponent's."
  },
  socratic: {
    debater_1: "You are Debater 1. Engage in Socratic questioning to probe the assumptions behind the debate topic. Encourage deeper exploration rather than merely defending a fixed position.",
    debater_2: "You are Debater 2. Respond to the questions raised with further questioning, uncovering contradictions or refining the argument. Seek to clarify rather than merely counter."
  },
  collaborative: {
    debater_1: "You are Debater 1. Present a reasoned argument while also considering alternative viewpoints. Aim to refine the discussion by integrating insights from both perspectives.",
    debater_2: "You are Debater 2. Engage constructively with the previous argument. Instead of purely opposing, synthesize perspectives and highlight nuances to advance the discussion."
  },
  adversarial: {
    debater_1: "You are Debater 1. Your goal is to strongly advocate for your position while **exposing weaknesses in any opposing argument**. Be aggressive in refuting errors while maintaining logical integrity.",
    debater_2: "You are Debater 2. Your goal is to **dismantle** the previous argument using **counter-evidence, logical dissection, or exposing hidden assumptions**. Aim to make flaws clear to a non-expert judge."
  }
};
