"use client";

import axios from "axios";
import Swal from "sweetalert2";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Lock,
  Mail,
  UserRound,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function toSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export default function SignupForm() {
  const router = useRouter();
  const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const [accountType, setAccountType] = useState("owner");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  const restaurantSlug = useMemo(
    () => toSlug(restaurantName || username),
    [restaurantName, username],
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (accountType === "owner" && !restaurantName.trim()) {
      setError("Please enter your restaurant name");
      return;
    }

    if (accountType === "owner" && !restaurantSlug) {
      setError("Restaurant name must contain at least one English letter or number");
      return;
    }

    if (!acceptTerms) {
      setError("Please accept the Terms and Conditions");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const payload = {
        username: username.trim(),
        password,
        email: email.trim(),
        role: accountType === "owner" ? "owner" : "user",
      };

      if (accountType === "owner") {
        payload.restaurant_name = restaurantName.trim();
        payload.restaurant_slug = restaurantSlug;
      }

      const response = await axios.post(`${baseurl}/auth/signup`, payload, {
        withCredentials: true,
      });

      if (response.status === 201) {
        await Swal.fire({
          icon: "success",
          title:
            accountType === "owner"
              ? "Restaurant account created"
              : "Signup successful",
          text:
            accountType === "owner"
              ? "Sign in to check your restaurant approval status."
              : "You can sign in and start ordering now.",
          confirmButtonColor: "#2d3e61",
        });
        router.push("/signin");
      }
    } catch (requestError) {
      const message =
        requestError.response?.data?.message ||
        requestError.message ||
        "Signup failed";

      setError(message);
      Swal.fire({
        icon: "error",
        title: "Signup failed",
        text: message,
        confirmButtonColor: "#ba1a1a",
      });
    } finally {
      setLoading(false);
    }
  };

  const disabled =
    loading ||
    !username.trim() ||
    !email.trim() ||
    !password ||
    !confirmPassword ||
    !acceptTerms ||
    (accountType === "owner" && (!restaurantName.trim() || !restaurantSlug));

  return (
    <main className="min-h-screen bg-[#f6f2ee] text-[#1b1b1e]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-5 py-8 sm:px-6 lg:py-12">
        <section className="grid w-full overflow-hidden rounded-lg border border-[#e4e2e5] bg-white shadow-xl lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative hidden min-h-[680px] bg-[#16284a] text-white lg:block">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-35"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1552566626-52f8b828add9?q=80&w=1974&auto=format&fit=crop')",
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#16284a] via-[#16284a]/75 to-[#16284a]/25" />
            <div className="absolute bottom-0 p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b5c6f1]">
                RestaurantOS
              </p>
              <h1 className="mt-4 max-w-sm text-4xl font-bold leading-tight">
                Create your restaurant workspace
              </h1>
              <p className="mt-4 max-w-sm text-base leading-7 text-[#d8e2ff]">
                Register as a customer, or open a new restaurant account for
                approval by the platform admin.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8 md:p-12">
            <div className="mb-8">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#6f7890]">
                Account setup
              </p>
              <h2 className="mt-2 text-3xl font-bold text-[#16284a]">
                Create an account
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#505f76]">
                Choose the account type that matches what you want to do next.
              </p>
            </div>

            <div className="mb-8 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAccountType("user")}
                className={`flex min-w-0 items-center gap-3 rounded-lg border p-4 text-left transition ${
                  accountType === "user"
                    ? "border-[#2d3e61] bg-[#f5f7ff]"
                    : "border-[#e4e2e5] bg-white hover:bg-slate-50"
                }`}
              >
                <UserRound className="h-5 w-5 shrink-0 text-[#2d3e61]" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    Customer account
                  </span>
                  <span className="block text-xs leading-5 text-[#505f76]">
                    Order food and manage your profile
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setAccountType("owner")}
                className={`flex min-w-0 items-center gap-3 rounded-lg border p-4 text-left transition ${
                  accountType === "owner"
                    ? "border-[#2d3e61] bg-[#f5f7ff]"
                    : "border-[#e4e2e5] bg-white hover:bg-slate-50"
                }`}
              >
                <Building2 className="h-5 w-5 shrink-0 text-[#2d3e61]" />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">
                    Restaurant owner
                  </span>
                  <span className="block text-xs leading-5 text-[#505f76]">
                    Create a restaurant for approval
                  </span>
                </span>
              </button>
            </div>

            {error ? (
              <div className="mb-6 rounded-lg border border-[#ba1a1a] bg-[#ffdad6] p-4">
                <p className="text-sm font-medium text-[#7d120f]">{error}</p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold" htmlFor="email">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8496]" />
                    <input
                      className="h-12 w-full rounded-lg border border-[#c5c6cf] bg-white pl-10 pr-3 text-base outline-none transition focus:border-[#2d3e61] focus:ring-1 focus:ring-[#2d3e61]"
                      id="email"
                      placeholder="name@restaurant.com"
                      type="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-semibold"
                    htmlFor="username"
                  >
                    Username
                  </label>
                  <input
                    className="h-12 w-full rounded-lg border border-[#c5c6cf] bg-white px-3 text-base outline-none transition focus:border-[#2d3e61] focus:ring-1 focus:ring-[#2d3e61]"
                    id="username"
                    placeholder="manager"
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                </div>
              </div>

              {accountType === "owner" ? (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label
                        className="mb-1 block text-xs font-semibold"
                        htmlFor="restaurantName"
                      >
                        Restaurant name
                      </label>
                      <input
                        className="h-12 w-full rounded-lg border border-[#c5c6cf] bg-white px-3 text-base outline-none transition focus:border-[#2d3e61] focus:ring-1 focus:ring-[#2d3e61]"
                        id="restaurantName"
                        placeholder="The Grand Bistro"
                        type="text"
                        value={restaurantName}
                        onChange={(event) => setRestaurantName(event.target.value)}
                        required
                      />
                    </div>
                    <div>
                      <label
                        className="mb-1 block text-xs font-semibold"
                        htmlFor="restaurantSlug"
                      >
                        Restaurant slug
                      </label>
                      <input
                        className="h-12 w-full rounded-lg border border-[#c5c6cf] bg-[#f5f3f6] px-3 text-base text-[#505f76]"
                        id="restaurantSlug"
                        type="text"
                        value={restaurantSlug}
                        disabled
                      />
                    </div>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                    <div className="flex items-start gap-3">
                      <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0" />
                      <p>
                        Owner accounts create a restaurant in pending status.
                        After signup, sign in and wait for superadmin approval.
                      </p>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label
                    className="mb-1 block text-xs font-semibold"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8496]" />
                    <input
                      className="h-12 w-full rounded-lg border border-[#c5c6cf] bg-white pl-10 pr-3 text-base outline-none transition focus:border-[#2d3e61] focus:ring-1 focus:ring-[#2d3e61]"
                      id="password"
                      placeholder="Enter password"
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="mb-1 block text-xs font-semibold"
                    htmlFor="confirm-password"
                  >
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7b8496]" />
                    <input
                      className="h-12 w-full rounded-lg border border-[#c5c6cf] bg-white pl-10 pr-3 text-base outline-none transition focus:border-[#2d3e61] focus:ring-1 focus:ring-[#2d3e61]"
                      id="confirm-password"
                      placeholder="Confirm password"
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              <label className="flex items-start gap-3 pt-2 text-sm leading-6 text-[#505f76]">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(event) => setAcceptTerms(event.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-[#c5c6cf]"
                />
                <span>I accept the Terms and Conditions</span>
              </label>

              <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="text-left text-xs font-semibold text-[#16284a] hover:text-[#4d5e83]"
                  onClick={() => router.push("/signin")}
                >
                  Already have an account?
                </button>
                <button
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#2d3e61] px-8 text-xs font-semibold text-white shadow-sm transition hover:bg-[#4d5e83] disabled:cursor-not-allowed disabled:opacity-50"
                  type="submit"
                  disabled={disabled}
                >
                  {loading
                    ? "Creating..."
                    : accountType === "owner"
                      ? "Create owner account"
                      : "Create account"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
