module.exports = {
  makeRedirectUri: () => "skanida://callback",
  useAuthRequest: jest.fn(() => [null, null, jest.fn()]),
  Prompt: { Consent: "consent" },
};
