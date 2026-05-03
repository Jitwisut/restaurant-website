"use client";

import Link from "next/link";
import Swal from "sweetalert2";
import { useAuth } from "../components/AuthProvider";
import { useRestaurantAccess } from "../components/useRestaurantAccess";
import { buildRestaurantPath } from "@/lib/auth";
import { createApiClient } from "@/lib/api";
import { useCallback, useEffect, useMemo, useState } from "react";

const sections = [
  { id: "profile", label: "ข้อมูลร้าน", icon: "storefront" },
  { id: "hours", label: "เวลาเปิด-ปิด", icon: "schedule" },
  { id: "security", label: "บัญชีและความปลอดภัย", icon: "shield_lock" },
  { id: "team", label: "สิทธิ์ทีมงาน", icon: "groups" },
  { id: "billing", label: "แพ็กเกจและการชำระเงิน", icon: "credit_card" },
  { id: "orders", label: "ตั้งค่าออเดอร์", icon: "receipt_long" },
  { id: "tables", label: "โต๊ะ / QR", icon: "qr_code_2" },
  { id: "menu", label: "ตั้งค่าเมนู", icon: "restaurant_menu" },
  { id: "notifications", label: "การแจ้งเตือน", icon: "notifications_active" },
  { id: "danger", label: "โซนอันตราย", icon: "warning" },
];

const days = [
  ["monday", "จันทร์"],
  ["tuesday", "อังคาร"],
  ["wednesday", "พุธ"],
  ["thursday", "พฤหัสบดี"],
  ["friday", "ศุกร์"],
  ["saturday", "เสาร์"],
  ["sunday", "อาทิตย์"],
];

function mergeSettings(settings = {}, auth = {}) {
  return {
    profile: {
      name: auth?.restaurantName || "",
      slug: auth?.restaurantSlug || "",
      logoDataUrl: "",
      contactEmail: "",
      phone: "",
      address: "",
      timezone: "Asia/Bangkok",
      ...(settings.profile || {}),
    },
    business_hours: settings.business_hours || {},
    account_security: {
      sessionTimeoutMinutes: 720,
      requireStrongPasswords: true,
      allowEmailLogin: true,
      ...(settings.account_security || {}),
    },
    team_settings: {
      ownerCanManageBilling: true,
      adminCanManageMenu: true,
      adminCanManageTables: true,
      kitchenCanAccessOrdersOnly: true,
      staffCanAccessTables: true,
      ...(settings.team_settings || {}),
    },
    order_settings: {
      serviceChargePercent: 0,
      taxPercent: 0,
      discountEnabled: true,
      promptPayId: "",
      promptPayType: "phone",
      promptPayAccountName: "",
      bankName: "",
      bankAccountNumber: "",
      ...(settings.order_settings || {}),
      paymentMethods: {
        cash: true,
        bankTransfer: true,
        qrPromptPay: false,
        card: false,
        ...(settings.order_settings?.paymentMethods || {}),
      },
    },
    table_qr_settings: {
      qrTheme: "standard",
      customerWelcomeMessage: "Welcome. Scan, order, and relax.",
      autoCloseSessionMinutes: 180,
      enforceBusinessHours: false,
      requireStaffToCloseTable: true,
      ...(settings.table_qr_settings || {}),
    },
    menu_settings: {
      categoryDefaults: ["appetizer", "main", "dessert", "drink"],
      hideUnavailableFromQr: true,
      placeholderImageUrl: "",
      ...(settings.menu_settings || {}),
    },
    notification_settings: {
      callStaffSound: true,
      orderAlertSound: true,
      kitchenAlertSound: true,
      browserNotifications: false,
      ...(settings.notification_settings || {}),
    },
    danger_zone: {
      temporaryClosed: false,
      archiveRequested: false,
      exportRequestedAt: null,
      ...(settings.danger_zone || {}),
    },
  };
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#2d3e61] focus:ring-2 focus:ring-[#2d3e61]/10"
    />
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:bg-slate-50"
    >
      <span className="text-sm font-semibold text-slate-800">{label}</span>
      <span
        className={`relative h-6 w-11 rounded-full transition ${
          checked ? "bg-[#2d3e61]" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </span>
    </button>
  );
}

export default function AdminSettingsPage() {
  const { signOut } = useAuth();
  const { auth, ready, allowed } = useRestaurantAccess([
    "owner",
    "admin",
    "superadmin",
  ]);
  const api = useMemo(() => createApiClient(auth?.token), [auth?.token]);
  const [active, setActive] = useState("profile");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(() => mergeSettings({}, auth));
  const [subscription, setSubscription] = useState(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
  });

  const setSection = (section, patch) => {
    setSettings((current) => ({
      ...current,
      [section]: {
        ...current[section],
        ...patch,
      },
    }));
  };

  const load = useCallback(async () => {
    if (!auth?.token) return;
    setLoading(true);
    try {
      const response = await api.get("/restaurant/settings");
      setSettings(mergeSettings(response.data.settings, auth));
      setSubscription(response.data.subscription || null);
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "โหลดการตั้งค่าไม่สำเร็จ",
        text: error.normalizedMessage || "ไม่สามารถโหลดการตั้งค่าร้านได้",
      });
    } finally {
      setLoading(false);
    }
  }, [api, auth]);

  useEffect(() => {
    if (!ready || !allowed || !auth?.token) return;
    load();
  }, [allowed, auth?.token, load, ready]);

  const save = async () => {
    setSaving(true);
    try {
      const response = await api.put("/restaurant/settings", settings);
      setSettings(mergeSettings(response.data.settings, auth));
      setSubscription(response.data.subscription || null);
      Swal.fire({
        icon: "success",
        title: "บันทึกการตั้งค่าแล้ว",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "บันทึกไม่สำเร็จ",
        text: error.normalizedMessage || "ไม่สามารถบันทึกการตั้งค่าได้",
      });
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    try {
      await api.put("/restaurant/account/password", passwordForm);
      setPasswordForm({ current_password: "", new_password: "" });
      Swal.fire({
        icon: "success",
        title: "เปลี่ยนรหัสผ่านแล้ว",
        timer: 1400,
        showConfirmButton: false,
      });
    } catch (error) {
      Swal.fire({
        icon: "error",
        title: "เปลี่ยนรหัสผ่านไม่สำเร็จ",
        text: error.normalizedMessage || "กรุณาลองใหม่อีกครั้ง",
      });
    }
  };

  const uploadLogo = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setSection("profile", { logoDataUrl: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const exportData = () => {
    const blob = new Blob([JSON.stringify(settings, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${settings.profile.slug || "restaurant"}-settings.json`;
    link.click();
    URL.revokeObjectURL(url);
    setSection("danger_zone", { exportRequestedAt: new Date().toISOString() });
  };

  if (!ready || (auth?.token && !allowed)) {
    return (
      <main className="min-h-screen bg-slate-50 grid place-items-center">
        <p className="text-slate-600">กำลังโหลดการตั้งค่าหลังบ้าน...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbf8fc] text-slate-900">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r border-slate-200 bg-white px-3 py-6 shadow-[4px_0_12px_rgba(45,62,97,0.04)] md:flex">
        <div className="mb-8 px-3">
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-3xl text-[#2d3e61]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              ร้านอาหาร
            </span>
            <span className="text-lg font-black tracking-tight">GastroManager</span>
          </div>
          <p className="ml-10 mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {settings.profile.name || auth?.restaurantName || "Restaurant"}
          </p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <Link
            href={buildRestaurantPath(auth, "admin")}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-xl">dashboard</span>
            แดชบอร์ด
          </Link>
          <Link
            href={buildRestaurantPath(auth, "tables")}
            className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
          >
            <span className="material-symbols-outlined text-xl">layers</span>
            ผังโต๊ะ
          </Link>
          <span className="flex items-center gap-3 rounded-l-lg border-r-4 border-[#2d3e61] bg-slate-50 px-4 py-3 text-sm font-bold text-[#2d3e61]">
            <span
              className="material-symbols-outlined text-xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              settings
            </span>
            ตั้งค่าหลังบ้าน
          </span>
        </nav>
        <button
          type="button"
          onClick={() => {
            signOut();
            window.location.href = "/signin";
          }}
          className="mt-auto flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100"
        >
          <span className="material-symbols-outlined text-xl">logout</span>
          ออกจากระบบ
        </button>
      </aside>

      <section className="min-h-screen p-5 md:ml-64 md:p-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">
              ตั้งค่าหลังบ้าน
            </h1>
            <p className="text-slate-600">
              จัดการข้อมูลร้าน เวลาเปิด-ปิด การชำระเงิน สิทธิ์ทีมงาน QR โต๊ะ
              เมนู ความปลอดภัย และการแจ้งเตือน
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            <aside className="w-full shrink-0 lg:w-72">
              <div className="sticky top-6 flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActive(section.id)}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition ${
                      active === section.id
                        ? "bg-slate-100 font-bold text-[#2d3e61]"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xl">
                      {section.icon}
                    </span>
                    {section.label}
                  </button>
                ))}
              </div>
            </aside>

            <div className="flex-1 space-y-6">
              {loading ? (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-500">
                  กำลังโหลดการตั้งค่า...
                </div>
              ) : (
                <>
                  {active === "profile" && (
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold">ข้อมูลร้าน</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        ชื่อร้าน slug โลโก้ ที่อยู่ เบอร์โทร และเขตเวลา
                      </p>
                      <div className="mt-6 grid gap-6 lg:grid-cols-[180px_1fr]">
                        <div className="flex flex-col items-center gap-3">
                          <label className="relative grid h-32 w-32 cursor-pointer place-items-center overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-sm text-slate-500">
                            {settings.profile.logoDataUrl ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={settings.profile.logoDataUrl}
                                  alt="Restaurant logo"
                                  className="absolute inset-0 h-full w-full object-cover"
                                />
                              </>
                            ) : (
                              <span className="material-symbols-outlined text-4xl">
                                add_photo_alternate
                              </span>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={uploadLogo}
                              className="hidden"
                            />
                          </label>
                          <span className="text-center text-xs text-slate-500">
                            แนะนำ 512x512 PNG/JPG
                          </span>
                        </div>
                        <div className="grid gap-4 md:grid-cols-2">
                          <Field label="ชื่อร้าน">
                            <TextInput
                              value={settings.profile.name}
                              onChange={(event) =>
                                setSection("profile", { name: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="Slug">
                            <TextInput
                              value={settings.profile.slug}
                              onChange={(event) =>
                                setSection("profile", { slug: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="อีเมลติดต่อ">
                            <TextInput
                              type="email"
                              value={settings.profile.contactEmail}
                              onChange={(event) =>
                                setSection("profile", {
                                  contactEmail: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="เบอร์โทร">
                            <TextInput
                              value={settings.profile.phone}
                              onChange={(event) =>
                                setSection("profile", { phone: event.target.value })
                              }
                            />
                          </Field>
                          <Field label="ที่อยู่ร้าน">
                            <TextInput
                              value={settings.profile.address}
                              onChange={(event) =>
                                setSection("profile", {
                                  address: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="เขตเวลา">
                            <TextInput
                              value={settings.profile.timezone}
                              onChange={(event) =>
                                setSection("profile", {
                                  timezone: event.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>
                      </div>
                    </section>
                  )}

                  {active === "hours" && (
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold">เวลาเปิด-ปิด</h2>
                      <div className="mt-5 grid gap-3">
                        {days.map(([key, label]) => {
                          const value = settings.business_hours[key] || {};
                          return (
                            <div
                              key={key}
                              className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_140px_140px_120px] md:items-center"
                            >
                              <span className="font-semibold">{label}</span>
                              <TextInput
                                type="time"
                                value={value.open || "09:00"}
                                disabled={value.closed}
                                onChange={(event) =>
                                  setSection("business_hours", {
                                    [key]: { ...value, open: event.target.value },
                                  })
                                }
                              />
                              <TextInput
                                type="time"
                                value={value.close || "22:00"}
                                disabled={value.closed}
                                onChange={(event) =>
                                  setSection("business_hours", {
                                    [key]: { ...value, close: event.target.value },
                                  })
                                }
                              />
                              <label className="flex items-center gap-2 text-sm font-semibold">
                                <input
                                  type="checkbox"
                                  checked={Boolean(value.closed)}
                                  onChange={(event) =>
                                    setSection("business_hours", {
                                      [key]: {
                                        ...value,
                                        closed: event.target.checked,
                                      },
                                    })
                                  }
                                />
                                Closed
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  )}

                  {active === "security" && (
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold">บัญชีและความปลอดภัย</h2>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 p-4">
                          <p className="text-sm font-bold text-slate-500">
                            เข้าสู่ระบบเป็น
                          </p>
                          <p className="mt-2 font-semibold">{auth?.username}</p>
                          <p className="text-sm text-slate-500">{auth?.role}</p>
                        </div>
                        <Field label="Session หมดอายุ (นาที)">
                          <TextInput
                            type="number"
                            min="15"
                            value={
                              settings.account_security.sessionTimeoutMinutes
                            }
                            onChange={(event) =>
                              setSection("account_security", {
                                sessionTimeoutMinutes: Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                        <Toggle
                          label="บังคับใช้รหัสผ่านที่เดายาก"
                          checked={
                            settings.account_security.requireStrongPasswords
                          }
                          onChange={(value) =>
                            setSection("account_security", {
                              requireStrongPasswords: value,
                            })
                          }
                        />
                        <Toggle
                          label="อนุญาตให้เข้าสู่ระบบด้วยอีเมล"
                          checked={settings.account_security.allowEmailLogin}
                          onChange={(value) =>
                            setSection("account_security", {
                              allowEmailLogin: value,
                            })
                          }
                        />
                      </div>
                      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <h3 className="font-semibold">เปลี่ยนรหัสผ่าน</h3>
                        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                          <TextInput
                            type="password"
                            placeholder="รหัสผ่านปัจจุบัน"
                            value={passwordForm.current_password}
                            onChange={(event) =>
                              setPasswordForm((current) => ({
                                ...current,
                                current_password: event.target.value,
                              }))
                            }
                          />
                          <TextInput
                            type="password"
                            placeholder="รหัสผ่านใหม่"
                            value={passwordForm.new_password}
                            onChange={(event) =>
                              setPasswordForm((current) => ({
                                ...current,
                                new_password: event.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            onClick={changePassword}
                            className="h-12 rounded-lg bg-[#2d3e61] px-5 text-sm font-bold text-white"
                          >
                            อัปเดตรหัสผ่าน
                          </button>
                        </div>
                      </div>
                    </section>
                  )}

                  {active === "team" && (
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold">สิทธิ์ทีมงาน</h2>
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {[
                          ["ownerCanManageBilling", "Owner จัดการแพ็กเกจและบิลได้"],
                          ["adminCanManageMenu", "Admin จัดการเมนูได้"],
                          ["adminCanManageTables", "Admin จัดการโต๊ะได้"],
                          [
                            "kitchenCanAccessOrdersOnly",
                            "Kitchen เข้าได้เฉพาะงานครัว/ออเดอร์",
                          ],
                          ["staffCanAccessTables", "Staff เข้าใช้งานหน้าโต๊ะได้"],
                        ].map(([key, label]) => (
                          <Toggle
                            key={key}
                            label={label}
                            checked={Boolean(settings.team_settings[key])}
                            onChange={(value) =>
                              setSection("team_settings", { [key]: value })
                            }
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {active === "billing" && (
                    <section className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <div className="absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-blue-50 to-transparent" />
                      <div className="relative">
                        <h2 className="text-xl font-semibold">ภาพรวมแพ็กเกจ</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          สถานะแพ็กเกจ วันหมดอายุ การต่ออายุ และประวัติคำขอชำระเงิน
                        </p>
                        <div className="mt-5 flex flex-col justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center">
                          <div>
                            <p className="text-sm font-bold uppercase tracking-wider text-slate-500">
                              {subscription?.plan_code || auth?.subscriptionPlan || "starter"}
                            </p>
                            <p className="mt-1 text-2xl font-bold capitalize">
                              {subscription?.status ||
                                auth?.subscriptionStatus ||
                                "unknown"}
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Expires{" "}
                              {subscription?.current_period_end
                                ? new Date(
                                    subscription.current_period_end,
                                  ).toLocaleDateString("th-TH")
                                : "-"}
                            </p>
                          </div>
                          <Link
                            href="/restaurant/billing"
                            className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-center text-sm font-bold text-slate-800 transition hover:bg-slate-100"
                          >
                            จัดการแพ็กเกจ
                          </Link>
                        </div>
                      </div>
                    </section>
                  )}

                  {active === "orders" && (
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold">ตั้งค่าออเดอร์</h2>
                      <div className="mt-5 grid gap-4 md:grid-cols-3">
                        <Field label="Service Charge %">
                          <TextInput
                            type="number"
                            value={settings.order_settings.serviceChargePercent}
                            onChange={(event) =>
                              setSection("order_settings", {
                                serviceChargePercent: Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                        <Field label="Tax / VAT %">
                          <TextInput
                            type="number"
                            value={settings.order_settings.taxPercent}
                            onChange={(event) =>
                              setSection("order_settings", {
                                taxPercent: Number(event.target.value),
                              })
                            }
                          />
                        </Field>
                        <Toggle
                          label="เปิดใช้นโยบายส่วนลด"
                          checked={settings.order_settings.discountEnabled}
                          onChange={(value) =>
                            setSection("order_settings", {
                              discountEnabled: value,
                            })
                          }
                        />
                      </div>
                      <div className="mt-5 grid gap-3 md:grid-cols-4">
                        {[
                          ["cash", "เงินสด"],
                          ["bankTransfer", "โอนเงิน"],
                          ["qrPromptPay", "QR PromptPay"],
                          ["card", "บัตร"],
                        ].map(([key, label]) => (
                          <Toggle
                            key={key}
                            label={label}
                            checked={Boolean(
                              settings.order_settings.paymentMethods[key],
                            )}
                            onChange={(value) =>
                              setSection("order_settings", {
                                paymentMethods: {
                                  ...settings.order_settings.paymentMethods,
                                  [key]: value,
                                },
                              })
                            }
                          />
                        ))}
                      </div>
                      {settings.order_settings.paymentMethods.qrPromptPay && (
                        <div className="mt-5 grid gap-4 rounded-xl border border-blue-100 bg-blue-50/70 p-4 md:grid-cols-2">
                        <Field label="ประเภท QR PromptPay">
                          <select
                            value={settings.order_settings.promptPayType || "phone"}
                            onChange={(event) =>
                              setSection("order_settings", {
                                promptPayType: event.target.value,
                              })
                            }
                            className="h-12 rounded-lg border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-[#2d3e61] focus:ring-2 focus:ring-[#2d3e61]/10"
                          >
                            <option value="phone">เบอร์พร้อมเพย์</option>
                            <option value="national_id">เลขบัตรประชาชน</option>
                            <option value="bank_account">เลขบัญชีธนาคาร</option>
                          </select>
                        </Field>
                        {settings.order_settings.promptPayType ===
                          "bank_account" && (
                          <Field label="ธนาคาร">
                            <TextInput
                              placeholder="เช่น กสิกรไทย / ไทยพาณิชย์"
                              value={settings.order_settings.bankName || ""}
                              onChange={(event) =>
                                setSection("order_settings", {
                                  bankName: event.target.value,
                                })
                              }
                            />
                          </Field>
                        )}
                        <Field
                          label={
                            settings.order_settings.promptPayType ===
                            "bank_account"
                              ? "เลขบัญชีธนาคาร"
                              : "เบอร์/เลขพร้อมเพย์"
                          }
                        >
                          <TextInput
                              placeholder="0812345678 หรือเลขบัญชี"
                              value={
                                settings.order_settings.promptPayType ===
                                "bank_account"
                                  ? settings.order_settings.bankAccountNumber ||
                                    ""
                                  : settings.order_settings.promptPayId || ""
                              }
                              onChange={(event) =>
                                setSection("order_settings", {
                                  [settings.order_settings.promptPayType ===
                                  "bank_account"
                                    ? "bankAccountNumber"
                                    : "promptPayId"]: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="ชื่อบัญชีรับเงิน">
                            <TextInput
                              placeholder="ชื่อบัญชีร้าน"
                              value={
                                settings.order_settings.promptPayAccountName ||
                                ""
                              }
                              onChange={(event) =>
                                setSection("order_settings", {
                                  promptPayAccountName: event.target.value,
                                })
                              }
                            />
                          </Field>
                          <p className="md:col-span-2 text-sm text-blue-900">
                            ระบบจะนำค่านี้ไปแสดงในหน้าลูกค้าและใช้ยอดรวมล่าสุด
                            สำหรับจ่ายผ่าน QR PromptPay/โอนบัญชี
                          </p>
                        </div>
                      )}
                    </section>
                  )}

                  {active === "tables" && (
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold">ตั้งค่าโต๊ะ / QR</h2>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <Field label="รูปแบบ QR">
                          <TextInput
                            value={settings.table_qr_settings.qrTheme}
                            onChange={(event) =>
                              setSection("table_qr_settings", {
                                qrTheme: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <Field label="หมดอายุ session โต๊ะ (นาที, ขั้นต่ำ 15)">
                          <TextInput
                            type="number"
                            value={
                              settings.table_qr_settings.autoCloseSessionMinutes
                            }
                            onChange={(event) =>
                              setSection("table_qr_settings", {
                                autoCloseSessionMinutes: Math.max(
                                  Number(event.target.value),
                                  15,
                                ),
                              })
                            }
                          />
                        </Field>
                        <Field label="ข้อความต้อนรับหน้าสั่งอาหาร">
                          <TextInput
                            value={
                              settings.table_qr_settings.customerWelcomeMessage
                            }
                            onChange={(event) =>
                              setSection("table_qr_settings", {
                                customerWelcomeMessage: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <Toggle
                          label="บังคับใช้เวลาเปิด-ปิดกับหน้า QR"
                          checked={
                            settings.table_qr_settings.enforceBusinessHours
                          }
                          onChange={(value) =>
                            setSection("table_qr_settings", {
                              enforceBusinessHours: value,
                            })
                          }
                        />
                        <Toggle
                          label="ต้องให้พนักงานเป็นคนปิดโต๊ะ"
                          checked={
                            settings.table_qr_settings.requireStaffToCloseTable
                          }
                          onChange={(value) =>
                            setSection("table_qr_settings", {
                              requireStaffToCloseTable: value,
                            })
                          }
                        />
                      </div>
                    </section>
                  )}

                  {active === "menu" && (
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold">ตั้งค่าเมนู</h2>
                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <Field label="หมวดหมู่เริ่มต้น (คั่นด้วย comma)">
                          <TextInput
                            value={settings.menu_settings.categoryDefaults.join(", ")}
                            onChange={(event) =>
                              setSection("menu_settings", {
                                categoryDefaults: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </Field>
                        <Field label="URL รูป placeholder เมนู">
                          <TextInput
                            value={settings.menu_settings.placeholderImageUrl}
                            onChange={(event) =>
                              setSection("menu_settings", {
                                placeholderImageUrl: event.target.value,
                              })
                            }
                          />
                        </Field>
                        <Toggle
                          label="ซ่อนเมนูที่ปิดขายจากหน้า QR"
                          checked={settings.menu_settings.hideUnavailableFromQr}
                          onChange={(value) =>
                            setSection("menu_settings", {
                              hideUnavailableFromQr: value,
                            })
                          }
                        />
                      </div>
                    </section>
                  )}

                  {active === "notifications" && (
                    <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold">การแจ้งเตือน</h2>
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        {[
                          ["callStaffSound", "เสียงเรียกพนักงาน"],
                          ["orderAlertSound", "เสียงแจ้งเตือนออเดอร์"],
                          ["kitchenAlertSound", "เสียงแจ้งเตือนครัว"],
                          ["browserNotifications", "แจ้งเตือนผ่าน browser"],
                        ].map(([key, label]) => (
                          <Toggle
                            key={key}
                            label={label}
                            checked={Boolean(settings.notification_settings[key])}
                            onChange={(value) =>
                              setSection("notification_settings", {
                                [key]: value,
                              })
                            }
                          />
                        ))}
                      </div>
                    </section>
                  )}

                  {active === "danger" && (
                    <section className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm">
                      <h2 className="text-xl font-semibold text-rose-700">
                        โซนอันตราย
                      </h2>
                      <div className="mt-5 grid gap-3">
                        <Toggle
                          label="ปิดร้านชั่วคราว"
                          checked={settings.danger_zone.temporaryClosed}
                          onChange={(value) =>
                            setSection("danger_zone", {
                              temporaryClosed: value,
                            })
                          }
                        />
                        <Toggle
                          label="ขอ archive ร้าน"
                          checked={settings.danger_zone.archiveRequested}
                          onChange={(value) =>
                            setSection("danger_zone", {
                              archiveRequested: value,
                            })
                          }
                        />
                        <button
                          type="button"
                          onClick={exportData}
                          className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-800 transition hover:bg-slate-50"
                        >
                          Export ข้อมูลการตั้งค่า
                        </button>
                      </div>
                    </section>
                  )}

                  <div className="sticky bottom-4 flex justify-end rounded-xl border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur">
                    <button
                      type="button"
                      onClick={save}
                      disabled={saving}
                      className="h-12 rounded-lg bg-[#2d3e61] px-6 text-sm font-bold text-white transition hover:bg-[#16284a] disabled:opacity-60"
                    >
                      {saving ? "กำลังบันทึก..." : "บันทึกการเปลี่ยนแปลง"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
