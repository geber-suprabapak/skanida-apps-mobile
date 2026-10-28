import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as bffModule from "~/utils/bff";
import ResetPassword from "../app/auth/ResetPassword";

const FAILURE_MESSAGE =
  "Password belum dapat dipastikan berubah. Coba masuk dengan password baru. Jika gagal, minta kode pemulihan baru kepada administrator.";

describe("student password reset errors", () => {
  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
  });

  it("does not mislabel an API failure as an invalid or expired code", async () => {
    jest
      .spyOn(bffModule, "bffRequest")
      .mockRejectedValueOnce(new Error("synthetic failure"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    await render(<ResetPassword />);

    for (const [label, value] of [
      ["NIS", "TEST-NIS"],
      ["Kode pemulihan", "TEST-CODE"],
      ["Password baru", "TestOnlyPass123!"],
      ["Konfirmasi password", "TestOnlyPass123!"],
    ]) {
      fireEvent.changeText(screen.getByLabelText(label), value);
      await waitFor(() =>
        expect(screen.getByLabelText(label).props.value).toBe(value),
      );
    }
    await fireEvent.press(
      screen.getByRole("button", { name: "Ganti Password" }),
    );

    await waitFor(() => expect(screen.getByText(FAILURE_MESSAGE)).toBeTruthy());
    expect(bffModule.bffRequest).toHaveBeenCalledTimes(1);
  });
});
