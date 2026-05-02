"use client";

import axios from "axios";
import Swal from "sweetalert2";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/AuthProvider";

export default function RegisterRestaurant() {
  const router = useRouter();
  const { auth, saveAuth } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const baseurl = process.env.NEXT_PUBLIC_BACKEND_URL;

  useEffect(() => {
    if (!name) {
      setSlug("");
      return;
    }

    setSlug(
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 100),
    );
  }, [name]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!auth?.token) {
        throw new Error("Please sign in before registering a restaurant.");
      }

      const response = await axios.post(
        `${baseurl}/restaurant/register`,
        { name, slug },
        {
          headers: {
            Authorization: `Bearer ${auth.token}`,
            "Content-Type": "application/json",
          },
        },
      );

      await saveAuth({
        ...auth,
        token: response.data.token || auth.token,
        refreshToken: response.data.refreshToken || auth.refreshToken,
        role: response.data.role || "owner",
        restaurant: response.data.restaurant,
        restaurantId: response.data.restaurant?.id,
        restaurantSlug: response.data.restaurant?.slug,
        restaurantStatus: response.data.restaurant?.status,
      });

      Swal.fire({
        icon: "success",
        title: "Registration Successful!",
        text: "Please wait for superadmin approval.",
        confirmButtonColor: "#2d3e61",
      }).then(() => router.push("/restaurant/pending"));
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
          requestError.message ||
          "An error occurred during registration.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#fbf8fc] text-[#1b1b1e] antialiased min-h-screen flex flex-col items-center justify-center p-8 font-sans">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-[0_12px_12px_rgba(45,62,97,0.04)] border border-[#e4e2e5] overflow-hidden flex flex-col md:flex-row">
        <div className="w-full md:w-5/12 bg-[#2d3e61] p-16 flex flex-col justify-between relative overflow-hidden text-white">
          <div
            className="absolute inset-0 opacity-20 bg-cover bg-center mix-blend-overlay"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1578474846511-04ba529f0b88?q=80&w=1974&auto=format&fit=crop')",
            }}
          />
          <div className="relative z-10">
            <div className="flex items-center gap-1 mb-16">
              <span
                className="material-symbols-outlined text-[36px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                restaurant_menu
              </span>
              <span className="font-bold text-[36px] tracking-tight">
                RestaurantOS
              </span>
            </div>
            <h1 className="font-semibold text-[30px] leading-[38px] mb-6">
              Welcome to the future of dining management.
            </h1>
            <p className="font-normal text-[16px] text-[#98a9d3]">
              Streamline your operations, manage orders efficiently, and focus
              on delivering exceptional culinary experiences.
            </p>
          </div>
        </div>

        <div className="w-full md:w-7/12 p-16 bg-white">
          <div className="mb-10">
            <h2 className="font-semibold text-[24px] text-[#16284a] mb-1">
              Register your restaurant
            </h2>
            <p className="font-normal text-[14px] text-[#505f76]">
              Fill in the details below to set up your administrative terminal.
            </p>
          </div>

          {error ? (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm font-medium">{error}</p>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-3">
              <h3 className="font-semibold text-[12px] text-[#1b1b1e] uppercase tracking-wider mb-3 border-b border-[#e4e2e5] pb-1">
                Business Profile
              </h3>

              <div>
                <label
                  className="block font-semibold text-[12px] text-[#1b1b1e] mb-1"
                  htmlFor="restaurantName"
                >
                  Restaurant Name
                </label>
                <input
                  className="w-full h-12 px-3 border border-[#c5c6cf] rounded-lg font-normal text-[16px] text-[#1b1b1e] bg-white focus:border-[#2d3e61] focus:ring-1 focus:ring-[#2d3e61] transition-colors outline-none"
                  id="restaurantName"
                  placeholder="e.g. The Grand Bistro"
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>

              <div>
                <label
                  className="block font-semibold text-[12px] text-[#1b1b1e] mb-1"
                  htmlFor="restaurantSlug"
                >
                  Restaurant Slug
                </label>
                <div className="flex shadow-sm rounded-lg">
                  <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-[#c5c6cf] bg-[#f5f3f6] text-[#505f76] font-normal text-[14px]">
                    os.com/
                  </span>
                  <input
                    className="flex-1 h-12 px-3 border border-[#c5c6cf] rounded-r-lg font-normal text-[16px] text-[#1b1b1e] bg-white disabled:bg-[#f5f3f6] disabled:text-[#75777f]"
                    disabled
                    id="restaurantSlug"
                    placeholder="the-grand-bistro"
                    type="text"
                    value={slug}
                  />
                </div>
              </div>
            </div>

            <div className="pt-10 flex items-center justify-between">
              <span
                className="font-semibold text-[12px] text-[#16284a] hover:text-[#4d5e83] transition-colors cursor-pointer"
                onClick={() => router.push("/signin")}
              >
                Already have an account?
              </span>
              <button
                className="h-12 px-10 bg-[#2d3e61] text-white font-semibold text-[12px] rounded-lg hover:bg-[#4d5e83] transition-colors shadow-sm flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                type="submit"
                disabled={loading || !name}
              >
                {loading ? "Registering..." : "Register Restaurant"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
