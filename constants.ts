import { DiagramExample } from "./types";

export const EXAMPLES: DiagramExample[] = [
  {
    id: 'flowchart',
    name: 'Flowchart',
    code: `flowchart TD
    A[Start] --> B{Is it working?}
    B -->|Yes| C[Great!]
    B -->|No| D[Debug]
    D --> B
    C --> E[End]`
  },
  {
    id: 'sequence',
    name: 'Sequence',
    code: `sequenceDiagram
    participant User
    participant System
    User->>System: Login Request
    System-->>User: Validate Credentials
    alt Valid
        System->>User: Token
    else Invalid
        System->>User: Error
    end`
  },
  {
    id: 'mindmap',
    name: 'Mind Map',
    code: `mindmap
  root((Mermaid))
    Origins
      Long history
      Open Source
    Features
      Flowcharts
      Sequence Diagrams
      Gantt Charts
    Usage
      Documentation
      Live Editor`
  },
  {
    id: 'broken',
    name: 'Broken (Test AI)',
    code: `flowchart TD
    A[Start] --> B{Missing Bracket
    B --> C[End]` 
  }
];

export const INITIAL_CODE = EXAMPLES[0].code;