import QRCode from "qrcode";
import generatePromptPayPayload from "promptpay-qr";

function maskPaymentTarget(value: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length < 5) return raw;
  return `${digits.slice(0, 3)}${"*".repeat(Math.max(digits.length - 6, 2))}${digits.slice(-3)}`;
}

export function buildPromptPayPayload(orderSettings: any, amount: number) {
  if (orderSettings?.promptPayType === "bank_account") return null;

  const target = String(orderSettings?.promptPayId || "").replace(/[^\d]/g, "");
  if (!target || !Number.isFinite(amount) || amount <= 0) return null;

  return generatePromptPayPayload(target, { amount: Number(amount.toFixed(2)) });
}

export async function buildBillPaymentQr(orderSettings: any, amount: number) {
  const paymentMethods = orderSettings?.paymentMethods || {};
  const normalizedAmount = Number(amount || 0);
  const promptPayEnabled = Boolean(
    paymentMethods.qrPromptPay &&
      orderSettings?.promptPayId &&
      orderSettings?.promptPayType !== "bank_account",
  );
  const promptPayPayload = promptPayEnabled
    ? buildPromptPayPayload(orderSettings, normalizedAmount)
    : null;
  const qrDataUrl = promptPayPayload
    ? await QRCode.toDataURL(promptPayPayload, {
        errorCorrectionLevel: "M",
        margin: 1,
        type: "image/png",
        width: 320,
      })
    : null;

  return {
    amount: normalizedAmount,
    currency: "THB",
    method: qrDataUrl
      ? "promptpay"
      : paymentMethods.bankTransfer
        ? "bank_transfer"
        : paymentMethods.cash
          ? "cash"
          : "unconfigured",
    promptpay: {
      enabled: Boolean(qrDataUrl),
      type: orderSettings?.promptPayType || "phone",
      target: maskPaymentTarget(orderSettings?.promptPayId || ""),
      account_name: orderSettings?.promptPayAccountName || "",
      qr_data_url: qrDataUrl,
    },
    bank_transfer: {
      enabled: Boolean(paymentMethods.bankTransfer),
      bank_name: orderSettings?.bankName || "",
      account_number: orderSettings?.bankAccountNumber || "",
      account_name: orderSettings?.promptPayAccountName || "",
    },
    cash: {
      enabled: Boolean(paymentMethods.cash),
    },
  };
}
