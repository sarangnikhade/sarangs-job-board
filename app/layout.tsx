import type { Metadata } from "next";
import { Saira_Condensed, Inter, JetBrains_Mono } from "next/font/google";
import { TopNav } from "@/components/brand/TopNav";
import { AddJobLauncher } from "@/components/board/AddJobLauncher";
import { JobSheet } from "@/components/board/JobSheet";
import { auth } from "@/auth";
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

/**
 * Root layout. The full app chrome (TopNav + JobSheet + AddJobLauncher)
 * only renders for authenticated users — the public landing page and
 * /signin both render bare under just the global font + canvas setup.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const signedIn = !!session?.user;

  return (
    <html
      lang="en"
      className={`${saira.variable} ${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {signedIn && <TopNav />}
        <div className="flex-1">{children}</div>
        {signedIn && <AddJobLauncher />}
        {signedIn && <JobSheet />}
      </body>
    </html>
  );
}
