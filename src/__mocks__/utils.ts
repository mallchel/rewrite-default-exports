import { mock } from 'node:test';

export const getFullPathFromRelative = mock.fn(({ relativePath }: { relativePath: string }) => {
  return relativePath;
});

export const getIsAcceptableModule = mock.fn(() => {
  return false;
});

export const getIsVisitedPath = mock.fn(() => {
  return false;
});
