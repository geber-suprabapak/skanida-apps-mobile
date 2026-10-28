import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { mockRouter } from "../__mocks__/expo-router";
import AuthSelector from "../app/auth/AuthSelector";

describe("password reset entry", () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it("opens the reset screen from the unauthenticated entry", async () => {
    await render(<AuthSelector />);

    const resetButton = screen.getByRole("button", {
      name: "Lupa password?",
    });
    expect(resetButton.props.accessibilityHint).toBe(
      "Buka formulir reset dengan kode pemulihan dari administrator",
    );
    expect(resetButton.props.className).toContain("min-h-12");

    await fireEvent.press(resetButton);
    expect(mockRouter.push).toHaveBeenCalledWith("/auth/ResetPassword");
  });
});
