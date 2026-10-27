export type DecisionContext = {
  situation: string;
  goals: string;
  constraints: string;
  timeline: string;
};

export type AgentCase = {
  id: "advocate" | "challenger";
  eyebrow: string;
  title: string;
  activity: string[];
  points: string[];
};

export type DecisionDimension = {
  id: string;
  label: string;
  score: number;
  scale: number;
  tone: "sage" | "brass" | "terra";
};

export type ChangeFactor = {
  id: string;
  condition: string;
  outcome: string;
  whyItMatters: string;
};

export type DecisionAnalysis = {
  id: string;
  decision: string;
  context: DecisionContext;
  advocateCase: AgentCase;
  challengerCase: AgentCase;
  dimensions: DecisionDimension[];
  confidence: {
    value: number;
    label: string;
    note: string;
  };
  leaning: string;
  leaningSummary: string;
  bottomLine: string;
  forPoints: string[];
  againstPoints: string[];
  keyInsights: string[];
  changeFactors: ChangeFactor[];
  nextSteps: string[];
  summary: string;
};
