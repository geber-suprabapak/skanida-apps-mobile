module.exports = {
  Camera: () => null,
  useCameraDevice: () => ({ id: "front-camera" }),
  useCameraPermission: () => ({
    hasPermission: false,
    requestPermission: jest.fn(),
  }),
};
