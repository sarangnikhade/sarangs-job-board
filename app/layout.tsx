import type { Metadata } from "next";
import { Saira_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import { TopNav } from "@/components/brand/TopNav";
import { AddJobLauncher } from "@/components/board/AddJobLauncher";
import { JobSheet } from "@/components/board/JobSheet";
import "./globals.css";

// Bugatti font substitutes (licensed faces unavailable).
const saira = Saira_Condensed({
  weight: ["400"],
  variable: "--font-saira",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  weight: ["400"],
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  weight: ["400"],
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Sarang's Job Board",
  description: "Pipeline tracker for job applications.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${saira.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TopNav />
        <main className="flex-1">{children}</main>
        <AddJobLauncher />
        <JobSheet />
      </body>
    </html>
  );
}
