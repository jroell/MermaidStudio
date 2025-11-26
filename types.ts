export interface DiagramExample {
  id: string;
  name: string;
  code: string;
}

export interface DiagramState {
  code: string;
  svg: string | null;
  error: string | null;
  lastRendered: number;
}

export interface ConnectionMap {
  [nodeId: string]: {
    upstream: string[];
    downstream: string[];
  }
}

export enum ViewMode {
  Split = 'SPLIT',
  EditorOnly = 'EDITOR',
  ViewOnly = 'VIEW',
}