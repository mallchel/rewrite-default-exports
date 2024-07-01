import { Component, ComponentType } from 'react';
import { connect } from 'react-redux';

import { Portal } from '../../components';

import { AttachmentModal } from './Attachment';
import { PageDeletingWarning } from './PageDeletingWarning/PageDeletingWarning';

export const modalProps = {};
export type ModalProps = {
  test: string;
};

const ModalView = ({ Modal }: { Modal: ComponentType }) => {
  return <Modal />;
};

const Test = connect((state) => {
  return {
    isSomething: (state as any).isSomething,
  };
})(
  class Modals extends Component<{ isSomething: boolean }> {
    getModalProviders = () => {
      const result = [];

      if (this.props.isSomething) {
        result.push(PageDeletingWarning);
      }

      result.push(AttachmentModal);

      return result;
    };

    render() {
      const providers = this.getModalProviders();

      if (providers.length) {
        return (
          <Portal>
            {providers.map((provider, index) => {
              return <ModalView Modal={provider} key={index} />;
            })}
          </Portal>
        );
      }

      return null;
    }
  },
);

export default Test;
