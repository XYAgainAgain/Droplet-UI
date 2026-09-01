export const MAX_DOCUMENTATION_WARNINGS = 3;

export function documentationWarningsFailBuild (count) {
  return count > MAX_DOCUMENTATION_WARNINGS;
}
