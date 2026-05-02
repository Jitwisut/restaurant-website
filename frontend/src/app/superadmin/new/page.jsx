"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Swal from "sweetalert2";
import { createApiClient } from "@/lib/api";
import { resolveRoleHome } from "@/lib/auth";
import { useAuth } from "@/app/components/AuthProvider";

function toSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

export default function SuperAdminCreateRestaurantPage() {
  const router = useRouter();
  const { auth, ready } = useAuth();
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const [form, setForm] = useState({
    name: "",
    slug: "",
    status: "active",
    plan: "free",
    username: "",
    email: "",
    password: "",
    role: "owner",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!auth?.token) {
      router.replace("/signin");
      return;
    }
    if (auth.role && auth.role !== "superadmin") {
      router.replace(resolveRoleHome(auth));
    }
  }, [auth, ready, router]);

  const derivedSlug = form.slug || toSlug(form.name);

  const handleChange = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await api.post("/restaurant/create", {
        name: form.name.trim(),
        slug: derivedSlug,
        status: form.status,
        plan: form.plan.trim() || "free",
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });

      await Swal.fire({
        icon: "success",
        title: "Restaurant created",
        text: `${response.data.restaurant?.name || form.name} and ${response.data.user?.username || form.username} are ready.`,
        confirmButtonColor: "#16284a",
      });

      router.push("/superadmin");
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "Create restaurant failed",
        text: error.normalizedMessage || "Please try again",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-background px-5 py-8 text-on-background sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-label-md uppercase tracking-[0.22em] text-slate-500">
              Superadmin
            </p>
            <h1 className="mt-2 text-h1 font-h1 text-primary">
              Add New Restaurant
            </h1>
            <p className="mt-2 max-w-2xl text-body-md text-slate-500">
              Create a restaurant tenant directly from the platform control
              panel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push("/superadmin")}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Back
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_12px_24px_-10px_rgba(22,40,74,0.04)]">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="font-h3 text-primary">Restaurant Details</h2>
            <p className="mt-1 text-sm text-slate-500">
              Fill in the core tenant information below.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="grid gap-6 px-6 py-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Restaurant Name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => handleChange("name", event.target.value)}
                  placeholder="The Grand Bistro"
                  className="h-12 w-full rounded-lg border border-slate-200 bg-surface-container-low px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-container/40"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Restaurant Slug
                </label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(event) => handleChange("slug", event.target.value)}
                  placeholder={toSlug(form.name) || "the-grand-bistro"}
                  className="h-12 w-full rounded-lg border border-slate-200 bg-surface-container-low px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-container/40"
                />
                <p className="mt-2 text-xs text-slate-400">
                  Final slug: {derivedSlug || "-"}
                </p>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(event) => handleChange("status", event.target.value)}
                  className="h-12 w-full rounded-lg border border-slate-200 bg-surface-container-low px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-container/40"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Plan
                </label>
                <input
                  type="text"
                  value={form.plan}
                  onChange={(event) => handleChange("plan", event.target.value)}
                  placeholder="free"
                  className="h-12 w-full rounded-lg border border-slate-200 bg-surface-container-low px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-container/40"
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Account Role
                </label>
                <select
                  value={form.role}
                  onChange={(event) => handleChange("role", event.target.value)}
                  className="h-12 w-full rounded-lg border border-slate-200 bg-surface-container-low px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-container/40"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Username
                </label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(event) =>
                    handleChange("username", event.target.value)
                  }
                  placeholder="grandbistro-owner"
                  className="h-12 w-full rounded-lg border border-slate-200 bg-surface-container-low px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-container/40"
                  required
                />
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => handleChange("email", event.target.value)}
                  placeholder="owner@grandbistro.com"
                  className="h-12 w-full rounded-lg border border-slate-200 bg-surface-container-low px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-container/40"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-500">
                  Password
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    handleChange("password", event.target.value)
                  }
                  placeholder="Create a secure password"
                  className="h-12 w-full rounded-lg border border-slate-200 bg-surface-container-low px-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-container/40"
                  required
                />
              </div>
            </div>

            <div className="rounded-xl bg-surface-container-low px-5 py-4 text-sm text-slate-600">
              The restaurant and its first login account will be created
              immediately. You can adjust status later from the superadmin
              dashboard.
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => router.push("/superadmin")}
                className="rounded-lg border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  submitting ||
                  !form.name.trim() ||
                  !derivedSlug ||
                  !form.username.trim() ||
                  !form.email.trim() ||
                  !form.password
                }
                className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-container disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? "Creating..." : "Create Restaurant"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
