import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--kit-font-body" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "600", "700", "800"], variable: "--kit-font-display" });

export const metadata: Metadata = {
  title: "Client Portal",
  description: "Your website, updates, requests and billing in one place.",
  icons: { icon: "/mark.svg" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Same cookie as LMS Dash. Read on the server so the page arrives in the right theme.
  const theme = (await cookies()).get("lms_look")?.value === "dark" ? "dark" : undefined;
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`} data-theme={theme}>
      <body className="font-sans text-sm leading-relaxed antialiased">{children}</body>
    </html>
  );
}
