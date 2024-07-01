const gridTypes = {
  one: 'one',
  two: 'two',
};

const Grid = ({ children, storeRef, style, attributes }: any) => {
  return (
    <div ref={storeRef} style={style} {...attributes}>
      {children}
    </div>
  );
};

export const gridProps = {
  types: gridTypes,
};

export default Grid;
