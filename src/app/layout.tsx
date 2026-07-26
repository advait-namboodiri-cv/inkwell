import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import Backdrop from "@/components/Backdrop";
import "./globals.css";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "inkwell",
  description: "the quiet companion for your reMarkable",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${lexend.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <Backdrop />
        {children}
      </body>
    </html>
  );
}
