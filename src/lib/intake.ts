// The questions a new client answers on their start link and on "Your project". They are
// the Inputs from LMS Dash's playbooks/00-client-intake.md, in the client's words. Pure data:
// the start flow, the portal page, the MCP tools and LMS Dash all read the same list.

export type IntakeQuestion = {
  key: string;
  label: string;
  hint?: string;
  /** One line, or a few. */
  long?: boolean;
  /** Filled from what we already know, so they only confirm it. */
  prefill?: "business" | "phone";
};

export const INTAKE_QUESTIONS: IntakeQuestion[] = [
  { key: "legalName", label: "Business name, exactly as it should appear", prefill: "business" },
  { key: "phone", label: "Phone number customers should call", prefill: "phone" },
  { key: "email", label: "Email where quote requests should go" },
  { key: "address", label: "Address", hint: "Or “no storefront” if you travel to customers." },
  { key: "hours", label: "Opening hours" },
  {
    key: "services",
    label: "What you do, most profitable first",
    hint: "One per line. The top three matter most.",
    long: true,
  },
  { key: "area", label: "Where you work", hint: "Towns and neighbourhoods you actually serve.", long: true },
  { key: "customer", label: "Your ideal customer, in your own words", long: true },
  { key: "proof", label: "Why people pick you", hint: "Years in business, licences, warranties, reviews, numbers.", long: true },
  { key: "competitors", label: "Who you lose jobs to", hint: "Two or three names or websites.", long: true },
  { key: "neverSay", label: "Anything we must never say or promise", hint: "Prices you don’t publish, claims you can’t back.", long: true },
  { key: "domain", label: "Your web address, if you have one", hint: "And where it was bought, if you know (GoDaddy, Namecheap…)." },
  { key: "assets", label: "Logo and photos", hint: "What you have today. You can upload them in the portal under Files.", long: true },
];

const KEYS = new Set(INTAKE_QUESTIONS.map((q) => q.key));
export const MAX_ANSWER = 2000;

/** Keep only known questions, trimmed and capped. Empty answers are dropped. */
export function cleanAnswers(input: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!KEYS.has(key) || typeof value !== "string") continue;
    const text = value.trim().slice(0, MAX_ANSWER);
    if (text) out[key] = text;
  }
  return out;
}

export function answeredCount(answers: Record<string, string>) {
  return INTAKE_QUESTIONS.filter((q) => answers[q.key]).length;
}

// The project stages LMS Dash pushes with set_client_stage, in order.
export const STAGES = ["discovery", "design", "build", "review", "launched"] as const;
export type Stage = (typeof STAGES)[number];
export function isStage(value: string): value is Stage {
  return (STAGES as readonly string[]).includes(value);
}
