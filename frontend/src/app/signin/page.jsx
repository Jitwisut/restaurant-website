"use client";

import axios from "axios";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "../components/AuthProvider";
import { resolveRoleHome } from "@/lib/auth";

export default function SignIn() {
  const router = useRouter();
  const { saveAuth } = useAuth();
  const [mode, setMode] = useState("admin");
  const [user, setUser] = useState({
    email: "",
    slug: "",
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;

  const handleChange = (event) => {
    setUser({ ...user, [event.target.name]: event.target.value });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endpoint =
        mode === "staff" ? "/auth/staff-signin" : "/auth/signin";
      const payload =
        mode === "staff"
          ? {
              slug: user.slug,
              username: user.username,
              password: user.password,
            }
          : {
              email: user.email,
              password: user.password,
            };
      const response = await axios.post(`${baseurl}${endpoint}`, payload);
      const session = await saveAuth(
        {
          ...response.data,
          token: response.data.token,
          refreshToken: response.data.refreshToken,
          role: response.data.role,
          redirectPath: response.data.redirectpath,
        },
        { hydrate: true },
      );

      router.push(resolveRoleHome(session));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          "เกิดข้อผิดพลาดในการเข้าสู่ระบบ",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#fbf8fc] text-[#1b1b1e] min-h-screen flex items-center justify-center font-sans antialiased p-8">
      <div className="w-full max-w-[1000px] bg-white rounded-xl shadow-[0_12px_24px_rgba(45,62,97,0.08)] overflow-hidden flex flex-col md:flex-row border border-[#e4e2e5]">
        <div className="hidden md:block w-1/2 relative bg-[#e9e7eb]">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1556155092-490a1ba16284?q=80&w=2070&auto=format&fit=crop')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#16284a]/80 to-transparent" />
          <div className="absolute bottom-0 left-0 p-10 text-white">
            <h2 className="font-semibold text-2xl mb-3">RestaurantOS</h2>
            <p className="font-normal text-base opacity-90">
              Secure multi-tenant access for modern gastronomy management.
            </p>
          </div>
        </div>

        <div className="w-full md:w-1/2 p-10 md:p-16 flex flex-col justify-center bg-white">
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-6 md:hidden">
              <span className="material-symbols-outlined text-[#2d3e61] text-2xl">
                restaurant
              </span>
              <span className="font-semibold text-xl text-[#2d3e61] font-bold">
                RestaurantOS
              </span>
            </div>
            <h1 className="font-semibold text-3xl text-[#1b1b1e] mb-1 tracking-tight">
              Welcome Back
            </h1>
            <p className="font-normal text-sm text-[#44474e]">
              Please sign in to access your dashboard.
            </p>
          </div>

          {error ? (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-[#f0f1f4] p-1">
              <button
                type="button"
                onClick={() => setMode("admin")}
                className={`h-10 rounded-md text-[12px] font-semibold transition-colors ${
                  mode === "admin"
                    ? "bg-white text-[#16284a] shadow-sm"
                    : "text-[#44474e] hover:text-[#16284a]"
                }`}
              >
                Owner / Admin
              </button>
              <button
                type="button"
                onClick={() => setMode("staff")}
                className={`h-10 rounded-md text-[12px] font-semibold transition-colors ${
                  mode === "staff"
                    ? "bg-white text-[#16284a] shadow-sm"
                    : "text-[#44474e] hover:text-[#16284a]"
                }`}
              >
                Staff / Kitchen
              </button>
            </div>

            {mode === "staff" ? (
              <>
                <div>
                  <label
                    className="block font-semibold text-[12px] text-[#1b1b1e] mb-1"
                    htmlFor="slug"
                  >
                    Restaurant Slug
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">
                      storefront
                    </span>
                    <input
                      className="w-full h-12 pl-10 pr-3 rounded-lg border border-[#c5c6cf] bg-white text-[#1b1b1e] focus:border-[#2d3e61] focus:ring-1 focus:ring-[#2d3e61] outline-none transition-colors font-normal text-base"
                      id="slug"
                      name="slug"
                      placeholder="my-restaurant"
                      type="text"
                      value={user.slug}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="block font-semibold text-[12px] text-[#1b1b1e] mb-1"
                    htmlFor="username"
                  >
                    Username
                  </label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">
                      badge
                    </span>
                    <input
                      className="w-full h-12 pl-10 pr-3 rounded-lg border border-[#c5c6cf] bg-white text-[#1b1b1e] focus:border-[#2d3e61] focus:ring-1 focus:ring-[#2d3e61] outline-none transition-colors font-normal text-base"
                      id="username"
                      name="username"
                      placeholder="kitchen"
                      type="text"
                      value={user.username}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label
                  className="block font-semibold text-[12px] text-[#1b1b1e] mb-1"
                  htmlFor="email"
                >
                  Email
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">
                    mail
                  </span>
                  <input
                    className="w-full h-12 pl-10 pr-3 rounded-lg border border-[#c5c6cf] bg-white text-[#1b1b1e] focus:border-[#2d3e61] focus:ring-1 focus:ring-[#2d3e61] outline-none transition-colors font-normal text-base"
                    id="email"
                    name="email"
                    placeholder="manager@restaurant.com"
                    type="email"
                    value={user.email}
                    onChange={handleChange}
                    required
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center mb-1">
                <label
                  className="block font-semibold text-[12px] text-[#1b1b1e]"
                  htmlFor="password"
                >
                  Password
                </label>
                <a
                  className="font-medium text-[11px] text-[#16284a] hover:text-[#2d3e61] transition-colors"
                  href="#"
                >
                  Forgot Password?
                </a>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#75777f]">
                  lock
                </span>
                <input
                  className="w-full h-12 pl-10 pr-3 rounded-lg border border-[#c5c6cf] bg-white text-[#1b1b1e] focus:border-[#2d3e61] focus:ring-1 focus:ring-[#2d3e61] outline-none transition-colors font-normal text-base"
                  id="password"
                  name="password"
                  placeholder="••••••••"
                  type="password"
                  value={user.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 bg-[#2d3e61] text-[#98a9d3] font-semibold text-[12px] rounded-lg hover:bg-[#16284a] transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <span className="material-symbols-outlined text-[18px]">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>

          <div className="mt-10 text-center">
            <p className="font-normal text-sm text-[#44474e]">
              Don&apos;t have an account?{" "}
              <span
                className="font-semibold text-[12px] text-[#16284a] hover:text-[#2d3e61] transition-colors cursor-pointer"
                onClick={() => router.push("/signup")}
              >
                Register a New Account
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
