export const init = jest.fn();
export const captureException = jest.fn();
export const captureMessage = jest.fn();
export const addBreadcrumb = jest.fn();
export const setUser = jest.fn();
export const showFeedbackWidget = jest.fn();
export const wrap = jest.fn((comp: any) => comp);
export const ReactNavigationInstrumentation = jest.fn().mockImplementation(() => ({
  registerNavigationContainer: jest.fn(),
}));
export const ReactNativeTracing = jest.fn().mockImplementation(() => ({}));

export default {
  init,
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  showFeedbackWidget,
  wrap,
  ReactNavigationInstrumentation,
  ReactNativeTracing,
};
