"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
export default function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try {
      const res = await axios.post(
        `${baseurl}/auth/signup`,
        {
          username,
          password,
          email,
          role: "user", // ✅ ตรงตาม backend ที่คุณกำหนดไว้
        },
        { withCredentials: true }
      );

      if (res.status === 201) {
        Swal.fire({
          icon: "success",
          title: "Signup Success!",
          text: "Please login now.",
          confirmButtonColor: "#6366F1",
        }).then(() => router.push("/signin"));
      }
    } catch (error) {
      console.error(error);
      const message =
        error.response?.data?.message || error.message || "Unknown error";

      setError(message);
      Swal.fire({
        icon: "error",
        title: "Signup Failed",
        text: message,
        confirmButtonColor: "#EF4444",
      });
    }
  };

  return (
    <section className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-gray-900 dark:via-gray-800 dark:to-gray-950">
      {/* Background pattern */}

      <div className="absolute inset-0 z-0 opacity-30">
        <div className="absolute -left-20 top-20 h-72 w-72 rounded-full bg-purple-300 blur-3xl dark:bg-purple-900"></div>
        <div className="absolute -right-20 bottom-20 h-72 w-72 rounded-full bg-blue-300 blur-3xl dark:bg-blue-900"></div>
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-300 blur-3xl dark:bg-teal-900"></div>
      </div>

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-8">
        <a
          href="#"
          className="mb-8 flex items-center gap-2 text-2xl font-semibold text-gray-900 dark:text-white"
        >
          <img
            src="https://flowbite.s3.amazonaws.com/blocks/marketing-ui/logo.svg"
            alt="Flowbite Logo"
            className="h-10 w-10 rounded-md object-contain"
          />
          <span>Flowbite</span>
        </a>

        <div className="w-full max-w-md overflow-hidden rounded-lg border-none bg-white/80 p-6 shadow-lg backdrop-blur-sm dark:bg-gray-800/80">
          <div className="space-y-1 pb-4">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              Create an account
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Enter your details to create your account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-900 dark:text-white"
              >
                Your email
              </label>

              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@gmail.com"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-purple-500"
                required
              />
            </div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-900 dark:text-white"
            >
              Your username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
              className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-purple-500"
              required
            />
            <div className="space-y-2">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-900 dark:text-white"
              >
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-purple-500"
                required
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-900 dark:text-white"
              >
                Confirm password
              </label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-sm text-gray-900 focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-purple-500"
                required
              />
            </div>

            <div className="flex items-start">
              <div className="flex h-5 items-center">
                <input
                  type="checkbox"
                  id="terms"
                  className="h-4 w-4 rounded border-gray-300 bg-gray-50 focus:ring-3 focus:ring-purple-300 dark:border-gray-600 dark:bg-gray-700 dark:focus:ring-purple-600 dark:ring-offset-gray-800"
                />
              </div>
              <div className="ml-3 text-sm">
                <label
                  htmlFor="terms"
                  className="font-light text-gray-500 dark:text-gray-300"
                >
                  I accept the{" "}
                  <a
                    href="#"
                    className="font-medium text-purple-600 hover:underline dark:text-purple-500"
                  >
                    Terms and Conditions
                  </a>
                </label>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-5 py-2.5 text-center text-sm font-medium text-white transition-all duration-200 hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-4 focus:ring-purple-300 dark:focus:ring-purple-800"
            >
              Create an account
            </button>

            <p className="text-sm font-light text-gray-500 dark:text-gray-400">
              Already have an account?{" "}
              <a
                href="#"
                className="font-medium text-purple-600 hover:underline dark:text-purple-500"
              >
                Login here
              </a>
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
