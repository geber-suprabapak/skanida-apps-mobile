import * as React from "react";
import {
  render,
  fireEvent,
  waitFor,
  cleanup,
  screen,
} from "@testing-library/react-native";
import Activate from "../app/auth/Activate";

/**
 * M03c — Activate form inputs have stable accessible names.
 *
 * Each Activate text input exposes an explicit `accessibilityLabel`
 * (matching the visible caption) plus a relevant `accessibilityHint`, so
 * assistive tech names the field independently of its placeholder text. The
 * name must stay stable after the user types a value, because that is
 * exactly when screen readers re-announce fields.
 *
 * This file intentionally keeps a single test: in this project's
 * jest-expo/React 19 renderer state, a mount that follows an interactive
 * test (even within the same file) commits an empty tree, so every screen's
 * flow runs as the first render of its own Jest module registry.
 *
 * Jest/RNTL proves the accessibility props are present and stable; it is not
 * device-level TalkBack proof (recorded separately as a native follow-up).
 */

const FIELDS = [
  {
    label: "NIS",
    hint: "Masukkan nomor induk siswa Anda untuk memulai aktivasi",
    value: "12345",
  },
  {
    label: "Email",
    hint: "Email untuk aktivasi akun Anda",
    value: "siswa@sekolah.sch.id",
  },
  {
    label: "Password",
    hint: "Minimal 8 karakter dengan huruf besar, huruf kecil, dan angka",
    value: "Rahasia123",
  },
  {
    label: "Konfirmasi Password",
    hint: "Ulangi password yang sama dengan di atas",
    value: "Rahasia123",
  },
] as const;

function expectStableAccessibleName(field: {
  label: string;
  hint: string;
  value: string;
}) {
  const input = screen.getByLabelText(field.label);
  expect(input.props.accessibilityLabel).toBe(field.label);
  expect(input.props.accessibilityHint).toBe(field.hint);
  // The accessible name must not be derived from the placeholder: the label
  // and hint stay identical while the placeholder remains display copy only.
  expect(input.props.placeholder).toBeTruthy();
  return input;
}

async function typeAndReassert(field: {
  label: string;
  hint: string;
  value: string;
}) {
  fireEvent.changeText(screen.getByLabelText(field.label), field.value);
  await waitFor(() => {
    const input = expectStableAccessibleName(field);
    expect(input.props.value).toBe(field.value);
  });
}

describe("M03c — Activate form inputs have stable accessible names", () => {
  afterEach(() => {
    cleanup();
  });

  it("every field is named and hinted, before and after values are entered", async () => {
    // Initial state: only the NIS step is visible.
    await render(<Activate />);
    const nis = expectStableAccessibleName(FIELDS[0]);
    expect(nis.props.placeholder).toBe("Masukkan NIS Anda");

    // Reveal the email/password/confirm section by checking a valid NIS.
    fireEvent.changeText(
      screen.getByLabelText(FIELDS[0].label),
      FIELDS[0].value,
    );
    await waitFor(() =>
      expect(screen.getByLabelText(FIELDS[0].label).props.value).toBe(
        FIELDS[0].value,
      ),
    );
    fireEvent.press(screen.getByLabelText("Periksa NIS"));
    await waitFor(() => expect(screen.getByLabelText("Email")).toBeTruthy());

    for (const field of FIELDS.slice(1)) {
      expectStableAccessibleName(field);
    }
    // Enter values into every field; accessible names must not change.
    for (const field of FIELDS) {
      await typeAndReassert(field);
    }
  });
});
