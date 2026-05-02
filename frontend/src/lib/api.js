"use client";

import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

export function createApiClient(token) {
  const client = axios.create({
    baseURL: API_BASE,
  });

  if (token) {
    client.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Request failed";
      error.normalizedMessage = message;
      return Promise.reject(error);
    },
  );

  return client;
}

export function buildWsUrl(path, token) {
  const base = process.env.NEXT_PUBLIC_API_WS || "";
  const url = new URL(`${base}${path}`);
  if (token) {
    url.searchParams.set("token", token);
  }
  return url.toString();
}
