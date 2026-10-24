const React = require("react");
const { View } = require("react-native");

module.exports = {
  Image: (props) =>
    React.createElement(View, { ...props, testID: "mock-expo-image" }),
};
