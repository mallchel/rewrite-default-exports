export const ApplicationProvider = ({ children }: { children: Function }) => {
  return <div>{children({ onApplicationLoad: true })}</div>;
};
