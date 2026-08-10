import "@testing-library/jest-dom/vitest";

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import AuthForm from "./AuthForm";

function renderForm(onSubmit: (e: string, p: string) => Promise<void>) {
  return render(
    <AuthForm
      title="Create your account"
      subtitle="sub"
      submitLabel="Create account"
      onSubmit={onSubmit}
      passwordAutoComplete="new-password"
      footer={{ prompt: "Already have one?", linkLabel: "Sign in", href: "/login" }}
    />
  );
}

describe("AuthForm", () => {
  it("passes the trimmed email and raw password to the caller", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    renderForm(onSubmit);

    await userEvent.type(screen.getByLabelText(/email/i), "  me@example.com  ");
    await userEvent.type(screen.getByLabelText(/password/i), " hunter2hunter2 ");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    // The email is trimmed because a stray paste-space makes it a different
    // account; the password is not, because whitespace is legitimately part
    // of it.
    expect(onSubmit).toHaveBeenCalledWith("me@example.com", " hunter2hunter2 ");
  });

  it("surfaces the backend's own error message", async () => {
    const onSubmit = vi
      .fn()
      .mockRejectedValue(new Error("password must be at least 8 characters"));
    renderForm(onSubmit);

    await userEvent.type(screen.getByLabelText(/email/i), "me@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "short");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "password must be at least 8 characters"
    );
  });

  it("re-enables the button after a failure so the user can retry", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("nope"));
    renderForm(onSubmit);

    await userEvent.type(screen.getByLabelText(/email/i), "me@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create account/i })).toBeEnabled()
    );
  });

  it("stays disabled after success, since the caller navigates away", async () => {
    // Re-enabling here would open a window for a double submit — a second
    // register call against an address that now exists.
    let resolve!: () => void;
    const onSubmit = vi.fn().mockReturnValue(new Promise<void>((r) => (resolve = r)));
    renderForm(onSubmit);

    await userEvent.type(screen.getByLabelText(/email/i), "me@example.com");
    await userEvent.type(screen.getByLabelText(/password/i), "hunter2hunter2");
    await userEvent.click(screen.getByRole("button", { name: /create account/i }));

    expect(screen.getByRole("button")).toBeDisabled();
    resolve();
    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
  });
});
