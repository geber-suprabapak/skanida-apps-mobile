import * as React from "react";
import {
  render,
  fireEvent,
  waitFor,
  cleanup,
  screen,
} from "@testing-library/react-native";
import ResetPassword from "../app/auth/ResetPassword";

/**
 * M03c — Reset Password form inputs have stable accessible names.
 *
 * Each Reset Password text input exposes an explicit `accessibilityLabel`
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
    hint: "Nomor induk siswa yang passwordnya akan direset",
    value: "12345",
  },
  {
    label: "Kode pemulihan",
    hint: "Kode pemulihan yang diberikan administrator sekolah",
    value: "ABC123",
  },
  {
    label: "Password baru",
    hint: "Minimal 8 karakter",
    value: "Rahasia123",
  },
  {
    label: "Konfirmasi password",
    hint: "Ulangi password baru yang sama",
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

describe("M03c — Reset Password form inputs have stable accessible names", () => {
  afterEach(() => {
    cleanup();
  });

  it("every field is named and hinted, before and after values are entered", async () => {
    await render(<ResetPassword />);
    for (const field of FIELDS) {
      expectStableAccessibleName(field);
    }
    for (const field of FIELDS) {
      await typeAndReassert(field);
    }
  });
});
