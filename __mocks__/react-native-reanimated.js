const { View } = require("react-native");

module.exports = {
  __esModule: true,
  default: {
    View,
    createAnimatedComponent: (component) => component,
  },
  useSharedValue: (value) => ({ value }),
  useAnimatedStyle: () => ({}),
  withTiming: (value) => value,
  withRepeat: (animation) => animation,
  withSequence: (...animations) => animations[0],
};
