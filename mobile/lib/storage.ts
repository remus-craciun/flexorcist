import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const API_URL_KEY = "flexorcist.apiUrl";
const TOKEN_KEY = "flexorcist.token";
const USER_EMAIL_KEY = "flexorcist.userEmail";
const PLACE_KEY = "flexorcist.place";

async function setItem(key: string, value: string) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string) {
  if (Platform.OS === "web") {
    return globalThis.localStorage?.getItem(key) ?? null;
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === "web") {
    globalThis.localStorage?.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function getApiUrl() {
  return getItem(API_URL_KEY);
}

export async function setApiUrl(url: string) {
  const normalized = url.trim().replace(/\/+$/, "");
  await setItem(API_URL_KEY, normalized);
  return normalized;
}

export async function clearApiUrl() {
  await deleteItem(API_URL_KEY);
}

export async function getToken() {
  return getItem(TOKEN_KEY);
}

export async function setToken(token: string) {
  await setItem(TOKEN_KEY, token);
}

export async function clearToken() {
  await deleteItem(TOKEN_KEY);
  await deleteItem(USER_EMAIL_KEY);
}

export async function getUserEmail() {
  return getItem(USER_EMAIL_KEY);
}

export async function setUserEmail(email: string) {
  await setItem(USER_EMAIL_KEY, email);
}

export async function getPreferredPlace() {
  const value = await getItem(PLACE_KEY);
  if (value === "home" || value === "park" || value === "gym") return value;
  return null;
}

export async function setPreferredPlace(place: "home" | "park" | "gym") {
  await setItem(PLACE_KEY, place);
}
