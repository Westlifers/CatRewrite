export interface TacticOption {
  id: string;
  label: string;
  command: string;
  description: string;
}

export const baseTacticOptions: TacticOption[] = [
  {
    id: "try",
    label: "try",
    command: "try",
    description: "Normalize, simplify with generated rules, and close the goal if both sides become equal."
  },
  {
    id: "simp",
    label: "simp",
    command: "simp",
    description: "Apply simplification rules such as triangle identities and counit naturality."
  },
  {
    id: "normalize",
    label: "normalize",
    command: "normalize",
    description: "Normalize identities, associativity, and functoriality on both sides."
  }
];
