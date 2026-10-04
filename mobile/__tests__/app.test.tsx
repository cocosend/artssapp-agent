import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as SecureStore from "expo-secure-store";
import App from "../App";

jest.mock("expo-secure-store", () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 1,
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedStore = SecureStore as jest.Mocked<typeof SecureStore>;

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn() as jest.Mock;
});

test("shows login when no access code is stored", async () => {
  mockedStore.getItemAsync.mockResolvedValue(null);
  render(<App />);
  expect(await screen.findByText("ARTSS AGENT")).toBeTruthy();
  expect(screen.getByLabelText("Access code")).toBeTruthy();
});

test("stores access code after login", async () => {
  mockedStore.getItemAsync.mockResolvedValue(null);
  mockedStore.setItemAsync.mockResolvedValue();
  (global.fetch as jest.Mock).mockResolvedValue({
    ok: true,
    json: async () => ({
      ok: true,
      providers: ["openai"],
      executionEnabled: true,
      githubWriteConfigured: true,
    }),
  });

  render(<App />);
  const input = await screen.findByLabelText("Access code");
  fireEvent.changeText(input, "test-code");
  fireEvent.press(screen.getByRole("button", { name: "Войти" }));

  await waitFor(() => expect(mockedStore.setItemAsync).toHaveBeenCalled());
  expect(await screen.findByLabelText("Agent task")).toBeTruthy();
});

test("clears access code on unauthorized agent response", async () => {
  mockedStore.getItemAsync.mockResolvedValue("saved-code");
  mockedStore.deleteItemAsync.mockResolvedValue();
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        ok: true,
        providers: ["openai"],
        executionEnabled: true,
        githubWriteConfigured: true,
      }),
    })
    .mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Access code required" }),
    });

  render(<App />);
  const task = await screen.findByLabelText("Agent task");
  fireEvent.changeText(task, "ping");
  fireEvent.press(screen.getByRole("button", { name: "Send task" }));

  await waitFor(() => expect(mockedStore.deleteItemAsync).toHaveBeenCalled());
  expect(await screen.findByLabelText("Access code")).toBeTruthy();
});
