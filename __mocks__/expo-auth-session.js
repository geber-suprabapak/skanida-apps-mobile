module.exports = {
  makeRedirectUri: () => "skanida://callback",
  useAuthRequest: () => [null, null, jest.fn()],
};
