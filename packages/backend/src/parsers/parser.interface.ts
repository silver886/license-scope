export interface ParsedDependency {
  name: string;
  version: string;
  isDirect: boolean;
  parentName?: string;
}

export interface DependencyParser {
  ecosystem: string;
  detect(repoPath: string): Promise<boolean>;
  parse(repoPath: string): Promise<ParsedDependency[]>;
}
