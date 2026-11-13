import trades from "@/templates/trades";
import roofing from "@/templates/roofing";
import landscaping from "@/templates/landscaping";
import cleaning from "@/templates/cleaning";
import auto from "@/templates/auto";
import restaurant from "@/templates/restaurant";
import clinic from "@/templates/clinic";
import salon from "@/templates/salon";
import professional from "@/templates/professional";
import rentals from "@/templates/rentals";

// The ten website designs a new client picks from. Each is one self-contained HTML document
// in src/templates/<slug>.ts with {{business}}, {{phone}}, {{tel}}, {{city}} and {{initial}}
// slots, so a prospect sees their own name on every design. They are starting points for
// the conversation, not finished sites: pictures are drawn photo slots.

export type SiteTemplate = {
  slug: string;
  name: string;
  /** Who it is for, shown on the card. */
  fits: string;
  /** What is distinctive about it, one line. */
  blurb: string;
  sample: { business: string; phone: string; city: string };
  html: string;
};

export const TEMPLATES: SiteTemplate[] = [
  { slug: "trades", name: "Workhorse", fits: "Plumbing, heating, electrical", blurb: "Phone number first. Emergency strip, services, reviews, quote form.", sample: { business: "Northgate Plumbing & Heating", phone: "519 555 0142", city: "London" }, html: trades },
  { slug: "roofing", name: "Ridgeline", fits: "Roofing, eavestrough, siding, renovation", blurb: "Before and after, warranty badges, financing band.", sample: { business: "Summit Roofing & Exteriors", phone: "519 555 0177", city: "London" }, html: roofing },
  { slug: "landscaping", name: "Greenhouse", fits: "Landscaping, lawn care, snow removal", blurb: "Soft and seasonal. Project gallery, services by season.", sample: { business: "Greenline Landscaping", phone: "519 555 0119", city: "London" }, html: landscaping },
  { slug: "cleaning", name: "Fresh Start", fits: "Home and office cleaning", blurb: "Clear packages with prices, what is included, book online.", sample: { business: "Brightside Cleaning Co.", phone: "519 555 0163", city: "London" }, html: cleaning },
  { slug: "auto", name: "Shop Floor", fits: "Auto repair, tires, detailing", blurb: "Service menu with from-prices, hours, book a bay.", sample: { business: "Ironworks Auto Repair", phone: "519 555 0188", city: "London" }, html: auto },
  { slug: "restaurant", name: "Supper", fits: "Restaurants, cafés, bakeries", blurb: "The menu on the page, hours, reserve a table.", sample: { business: "Olive & Ember", phone: "519 555 0126", city: "London" }, html: restaurant },
  { slug: "clinic", name: "Calm", fits: "Dental, physio, chiropractic, wellness", blurb: "Quiet and reassuring. New patient steps, team, insurance.", sample: { business: "Riverbend Dental", phone: "519 555 0151", city: "London" }, html: clinic },
  { slug: "salon", name: "Atelier", fits: "Hair, barber, nails, spa", blurb: "Editorial look. Price list, stylists, book now.", sample: { business: "Studio Lune", phone: "519 555 0134", city: "London" }, html: salon },
  { slug: "professional", name: "Ledger", fits: "Accounting, law, insurance, real estate", blurb: "Trust first. Practice areas, numbers, book a consultation.", sample: { business: "Hartwell & Co.", phone: "519 555 0105", city: "London" }, html: professional },
  { slug: "rentals", name: "Yard", fits: "Equipment and trailer rental, sales", blurb: "A catalogue with day and week rates, how renting works.", sample: { business: "Trailhead Rentals", phone: "519 555 0170", city: "London" }, html: rentals },
];

export function findTemplate(slug: string | null | undefined): SiteTemplate | undefined {
  return TEMPLATES.find((t) => t.slug === slug);
}

export type TemplateFill = { business?: string | null; phone?: string | null; city?: string | null };

function escapeHtml(text: string) {
  return text.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

function clip(value: string | null | undefined, max: number) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** The design as a full HTML page with this business's name, phone and town filled in. */
export function renderTemplate(template: SiteTemplate, fill: TemplateFill = {}): string {
  const business = clip(fill.business, 60) || template.sample.business;
  const phone = clip(fill.phone, 24) || template.sample.phone;
  const city = clip(fill.city, 40) || template.sample.city;
  const values: Record<string, string> = {
    business: escapeHtml(business),
    phone: escapeHtml(phone),
    tel: phone.replace(/[^\d+]/g, ""),
    city: escapeHtml(city),
    initial: escapeHtml([...business][0]?.toUpperCase() ?? "A"),
  };
  return template.html.replace(/\{\{(business|phone|tel|city|initial)\}\}/g, (_m, key: string) => values[key]!);
}

/** Query string that carries a fill to /templates and /templates/<slug>. */
export function fillQuery(fill: TemplateFill) {
  const q = new URLSearchParams();
  if (fill.business) q.set("name", fill.business);
  if (fill.phone) q.set("phone", fill.phone);
  if (fill.city) q.set("city", fill.city);
  const text = q.toString();
  return text ? `?${text}` : "";
}
