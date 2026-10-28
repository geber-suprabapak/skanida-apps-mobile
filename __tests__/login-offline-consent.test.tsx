import { cleanup, render } from "@testing-library/react-native";
import * as AuthSession from "expo-auth-session";
import Login from "../app/auth/Login";

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

it("requests explicit offline consent with PKCE so native login can receive a refresh token", async () => {
  const request = jest.mocked(AuthSession.useAuthRequest);
  request.mockClear();
  await render(<Login />);
  const config = request.mock.calls[0][0];
  expect(config.scopes).toContain("offline_access");
  expect(config.usePKCE).toBe(true);
  expect(config.prompt).toBe("consent");
});
