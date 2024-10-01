export const buildCodeFromLines = <const T>(...lines: T[]) => {
  return lines.join('\n') as T;
};
