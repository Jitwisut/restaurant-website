import { applySubscriptionTransitions, ensureSubscriptionSchema } from "../lib/subscription";

try {
  await ensureSubscriptionSchema();
  await applySubscriptionTransitions();
  console.log("Subscription cycle completed successfully.");
} catch (error) {
  console.error("Subscription cycle failed:", error);
  process.exitCode = 1;
}
