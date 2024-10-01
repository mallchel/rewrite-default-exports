import { removeModalActions } from 'sn-front.api-endpoints/src/triggers';
import uuid from 'uuid';
import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import get from 'lodash/get';

import { redirectToHref } from 'jsfcore/helpers/url';
import Group, { groupProps } from '@pdffiller/jsf-ui/components/Group/Group';
import GroupItem from '@pdffiller/jsf-ui/components/Group/GroupItem';
import CustomSettings, {
  customSettingsProps,
} from '@pdffiller/jsf-ui/components/CustomSettings/CustomSettings';
import ScrollBox, { scrollBoxProps } from '@pdffiller/jsf-ui/components/ScrollBox/ScrollBox';
import FlexGrid, { flexGridProps } from '@pdffiller/jsf-ui/components/FlexGrid/FlexGrid';
import DialogContent, {
  dialogContentProps,
} from '@pdffiller/jsf-ui/components/DialogContent/DialogContent';
import attributes from '@pdffiller/jsf-ui/components/attributes/attributes';
import { actions as jsfcoreModalsActions } from 'jsfcore/jsf-modals';
import { StoreRefProvider } from 'jsfcore/components';
import { getIsUpdAlertEnabled } from 'jsfcore/store/selectors/featureSelectors';
import { IntlContext } from 'jsfcore/jsf-localization';
import { getDocumentWithPaymentRequest } from 'jsfcore/store/selectors/payments';

import goHomeAction from '../../actions/goHome';
import { getIsSignNowSandbox } from '../../helpers/payments';
import DocumentHelper from '../../services/DocumentHelper';
import { dialogSizes, dialogThemes, dialogTypes, dialogBehaviors } from '../../ui/Dialog';
import toastr from '../../actions/toastrActions';
import * as sn from '../../selectors/snSelectors';
import * as accessibility from '../../selectors/accessibilitySelectors';
import { COMPLETE_TEST_PAYMENT_MODAL } from './consts';
import MakePaymentHeader from './MakePaymentHeader';
import MakePaymentFooter from './MakePaymentFooter';
import MakePaymentForm from './MakePaymentForm';
import MakePaymentPreview from './MakePaymentPreview';
import paymentApi from '../../sagas/api/paymentLogic';
import { modalsMap, modalTypes } from '../../actions/modalsActions';
import { setIsPaymentMadeSuccess } from '../../actions/snActions';
import * as FocusTrap from '../FocusTrap';
import { modalAnimationPhone } from '../../const';
import { SandboxNotification } from './SandboxNotification';
import { withPaymentServiceData } from './withPaymentServiceData';
import {
  trackClickOnCancelOrXSigner,
  trackClickOnSubmitPayment,
  trackMakePaymentModalShown,
  trackSuccessfulPaymentViaACH,
  trackSuccessfulPaymentViaCard,
} from '../../services/track';

const mobileGuidedModeStyles = {
  size: dialogSizes.parent,
  theme: dialogThemes.primary,
  type: dialogTypes.fluid,
  offset: null,
};

const styles = {
  size: dialogSizes.extraLarge,
  theme: dialogThemes.flatWhite,
  behavior: dialogBehaviors.insetOffsets,
  type: dialogTypes.scrollable,
  offset: null,
};

const phoneDialogProps = {
  headerProps: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  footerProps: {
    paddingAll: 4,
  },
};

const dialogContentBodyProps = {
  paddingAll: 12,
};

const { PAYMENT_MERCHANT_TYPES } = paymentApi;

const formWrapperAttributes = {
  role: 'none',
};

const toasterDelayTimeout = 1000;

class MakePaymentProvider extends Component {
  static propTypes = {
    children: PropTypes.func.isRequired,
    document: PropTypes.shape({
      id: PropTypes.string.isRequired,
      document_name: PropTypes.string.isRequired,
      owner: PropTypes.string.isRequired,
    }).isRequired,
    isSigningSessionOrViewOnlyOnPhone: PropTypes.bool.isRequired,
    isUpdAlertEnabled: PropTypes.bool.isRequired,
    requestPayment: PropTypes.shape({
      id: PropTypes.string.isRequired,
      amount: PropTypes.string.isRequired,
      currency: PropTypes.string.isRequired,
      publishable_key: PropTypes.string,
      merchant_type: PropTypes.string.isRequired,
      stripe: PropTypes.shape({
        display_ach_form: PropTypes.bool.isRequired,
        display_credit_card_form: PropTypes.bool.isRequired,
      }),
      stripe_ach: PropTypes.shape({}),
    }).isRequired,
    isSignnowSandboxPayment: PropTypes.bool.isRequired,
    isAccessibilityMode: PropTypes.bool.isRequired,
    openModal: PropTypes.func.isRequired,
    closeModal: PropTypes.func.isRequired,
    setIsPaymentMadeSuccess: PropTypes.func.isRequired,
    paymentServiceData: PropTypes.shape({
      stripe: PropTypes.shape({}),
      elements: PropTypes.shape({}),
    }),
    redirectUri: PropTypes.string.isRequired,
    isDocumentOwner: PropTypes.bool.isRequired,
    goHome: PropTypes.func.isRequired,
  };

  static defaultProps = {
    paymentServiceData: null,
  };

  static contextType = IntlContext;

  constructor(props) {
    super(props);

    this.titleId = uuid.v4();
    this.formRef = null;
    this.state = { isSubmiting: false };
  }

  componentDidMount() {
    trackMakePaymentModalShown();
  }

  getFormState = () => {
    return get(this.formRef, 'state', {});
  };

  getTokenCreator = (data) => {
    const { requestPayment, paymentServiceData } = this.props;

    switch (requestPayment.merchant_type) {
      case PAYMENT_MERCHANT_TYPES.StripeConnect:
        return paymentApi.stipeConnect.getPaymentMethod(paymentServiceData, data);
      case PAYMENT_MERCHANT_TYPES.Stripe:
        return paymentApi.createCardToken(paymentServiceData, data);
      default:
        return Promise.resolve();
    }
  };

  storeFormRef = (ref) => {
    this.formRef = ref;
  };

  formatMessage = (id) => {
    return this.context.formatMessage('', id);
  };

  onClose = (isPaymentMade = false) => {
    if (isPaymentMade) {
      this.props.setIsPaymentMadeSuccess();
    }

    return () => {
      trackClickOnCancelOrXSigner();

      this.props.closeModal(
        modalsMap[modalTypes.makePayment],
        isPaymentMade,
        modalAnimationPhone.preventCloseHooks,
      );
    };
  };

  onSuccessClose = (redirectUri) => {
    if (redirectUri) {
      redirectToHref(redirectUri);
    }

    this.onClose(true)();
  };

  onSubmit = () => {
    trackClickOnSubmitPayment();

    const {
      document,
      requestPayment,
      openModal,
      paymentServiceData,
      redirectUri,
      isDocumentOwner,
      isSignnowSandboxPayment,
    } = this.props;

    if (!isSignnowSandboxPayment && !this.formRef.validateFields()) {
      return;
    }

    const setSubmitting = (isSubmiting) => {
      this.setState({ isSubmiting });
    };
    const formState = this.getFormState();
    const { paymentMethod } = formState;

    const errorHandler = (error) => {
      if (!error) {
        return;
      }

      let message;
      if (error.code === 'routing_number_invalid') {
        message = 'MAKE_PAYMENT.ACH_ROUTING_NUMBER_INVALID';
      } else if (error.code === 'account_number_invalid') {
        message = 'MAKE_PAYMENT.ACH_ACCOUNT_NUMBER_INVALID';
      } else {
        message = error.message; // eslint-disable-line prefer-destructuring
      }

      toastr.error(message);

      throw this.formatMessage(message);
    };
    const finalError = () => {
      toastr.error('MAKE_PAYMENT.PAYMENT_ERROR');
      setSubmitting(false);
    };

    setSubmitting(true);

    if (paymentMethod === paymentApi.PAYMENT_METHODS.CreditCard || isSignnowSandboxPayment) {
      const tokenCreator = this.getTokenCreator(formState);

      tokenCreator
        .then((token) => {
          return paymentApi.makePayment(document.id, {
            ...requestPayment,
            paymentMethod,
            paymentServiceData,
            token,
          });
        }, errorHandler)
        .then(() => {
          if (!isSignnowSandboxPayment) {
            toastr.success(
              this.props.isUpdAlertEnabled
                ? { title: 'MAKE_PAYMENT.PAYMENT_SUCCESS_TITLE' }
                : 'MAKE_PAYMENT.PAYMENT_SUCCESS',
            );
          }

          trackSuccessfulPaymentViaCard(isDocumentOwner, isSignnowSandboxPayment);

          if (isSignnowSandboxPayment) {
            toastr.success('MAKE_PAYMENT.SANDBOX_PAYMENT_COMPLETED');

            if (isDocumentOwner) {
              removeModalActions(COMPLETE_TEST_PAYMENT_MODAL);

              return setTimeout(() => {
                this.props.goHome();
              }, toasterDelayTimeout);
            }
          }

          return this.onSuccessClose(redirectUri);
        }, finalError);
    } else {
      const processPayment = () => {
        return paymentApi
          .makePayment(document.id, { ...requestPayment, paymentMethod })
          .then(() => {
            trackSuccessfulPaymentViaACH(isDocumentOwner);

            this.onSuccessClose(redirectUri);
          });
      };

      paymentApi
        .createAchToken(paymentServiceData, formState)
        .then(paymentApi.createBankAccountForACH(document.id, requestPayment.id), errorHandler)
        .then(({ verified }) => {
          if (verified) {
            return processPayment();
          }

          return openModal(modalsMap[modalTypes.verifyBankAccount]).then(
            ({ verified: verifiedFromModal }) => {
              if (this.props.isUpdAlertEnabled) {
                toastr.warning({
                  title: 'MAKE_PAYMENT.MICRODEPOSITS_SENT_TITLE',
                  description: 'MAKE_PAYMENT.MICRODEPOSITS_SENT_DESCRIPTION',
                });
              } else {
                toastr.success('MAKE_PAYMENT.MICRODEPOSITS_SENT');
              }
              setSubmitting(false);

              if (verifiedFromModal) {
                return processPayment();
              }

              return false;
            },
          );
        }, finalError);
    }
  };

  renderMobileContent = () => {
    return (
      <ScrollBox theme={scrollBoxProps.themes.smoke}>
        <DialogContent
          offset={dialogContentProps.offsets.null}
          dialogContentBodyProps={dialogContentBodyProps}
        >
          <CustomSettings theme={customSettingsProps.themes.unbordered}>
            {this.props.isSignnowSandboxPayment && <SandboxNotification />}

            <MakePaymentForm
              isSigningSessionOrViewOnlyOnPhone={this.props.isSigningSessionOrViewOnlyOnPhone}
              document={this.props.document}
              requestPayment={this.props.requestPayment}
              ref={this.storeFormRef}
            />
          </CustomSettings>
        </DialogContent>
      </ScrollBox>
    );
  };

  renderContent = () => {
    return (
      <DialogContent offset={dialogContentProps.offsets.medium}>
        {this.props.isSignnowSandboxPayment && <SandboxNotification />}
        <Group type={groupProps.types.compact} offset={groupProps.offsets.largeHorizontal}>
          <GroupItem attributes={attributes.grow}>
            <FlexGrid
              type={flexGridProps.types.compact}
              verticalOffset={flexGridProps.verticalOffsets.small}
              horizontalOffset={flexGridProps.horizontalOffsets.large}
              behavior={flexGridProps.behaviors.table}
              // нужнно назначить role="none" для враппера формы
              // потому что читалки расценивают ее как таблицу и зачитывают лишнюю инфу
              attributes={formWrapperAttributes}
            >
              <StoreRefProvider>
                {({ storeRefs, getRefsPromise }) => {
                  return (
                    <MakePaymentForm
                      isSigningSessionOrViewOnlyOnPhone={
                        this.props.isSigningSessionOrViewOnlyOnPhone
                      }
                      document={this.props.document}
                      requestPayment={this.props.requestPayment}
                      ref={this.storeFormRef}
                      storeRefs={storeRefs}
                      getRefsPromise={getRefsPromise}
                    />
                  );
                }}
              </StoreRefProvider>
            </FlexGrid>
          </GroupItem>
          <GroupItem>
            <MakePaymentPreview
              onViewDocument={this.onClose(false)}
              documentId={this.props.document.id}
            />
          </GroupItem>
        </Group>
      </DialogContent>
    );
  };

  render() {
    const { isSigningSessionOrViewOnlyOnPhone } = this.props;
    const props = isSigningSessionOrViewOnlyOnPhone ? mobileGuidedModeStyles : styles;

    return (
      <FocusTrap.Provider modalsListDisableVisibility={['isVerifyBankAccountModalVisible']}>
        {({ wrapperClassName }) => {
          return this.props.children({
            onClose: this.onClose(false),
            props,
            dialogClassName: this.props.isAccessibilityMode
              ? `${wrapperClassName} is-accessibility`
              : wrapperClassName,
            dialogAriaLabelledby: this.titleId,
            isFullScreenModalPhone: isSigningSessionOrViewOnlyOnPhone,
            ...(isSigningSessionOrViewOnlyOnPhone && phoneDialogProps),
            header: (
              <MakePaymentHeader
                isSigningSessionOrViewOnlyOnPhone={isSigningSessionOrViewOnlyOnPhone}
                onClose={this.onClose(false)}
                titleId={this.titleId}
              />
            ),
            footer: (
              <MakePaymentFooter
                onClose={this.onClose(false)}
                isSigningSessionOrViewOnlyOnPhone={isSigningSessionOrViewOnlyOnPhone}
                onSubmit={this.onSubmit}
                isSubmiting={this.state.isSubmiting}
              />
            ),
            component: isSigningSessionOrViewOnlyOnPhone
              ? this.renderMobileContent()
              : this.renderContent(),
          });
        }}
      </FocusTrap.Provider>
    );
  }
}

export default connect(
  (state) => {
    const user = sn.getExternalUser(state);
    const documentWithPaymentRequest = getDocumentWithPaymentRequest(state);
    const requestPayment = documentWithPaymentRequest.payment_request;

    return {
      document: documentWithPaymentRequest,
      requestPayment,
      isAccessibilityMode: accessibility.getIsAccessibilityMode(state),
      isUpdAlertEnabled: getIsUpdAlertEnabled(state),
      redirectUri: DocumentHelper.getRedirectUriFromInvite(documentWithPaymentRequest, user),
      isDocumentOwner: sn.getIsDocumentOwner(state),
      isSignnowSandboxPayment: getIsSignNowSandbox(requestPayment.merchant_type),
    };
  },
  {
    openModal: jsfcoreModalsActions.openModal,
    closeModal: jsfcoreModalsActions.closeModal,
    goHome: goHomeAction,
    setIsPaymentMadeSuccess,
  },
)(withPaymentServiceData(MakePaymentProvider));
