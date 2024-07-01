import { Child } from './Child';
import { Icon } from './Icon';

const Button = () => {
  return (
    <button>
      <Child />
      <Icon />
    </button>
  );
};

export default Button;

export const Test = () => {
  return <Child />;
};
