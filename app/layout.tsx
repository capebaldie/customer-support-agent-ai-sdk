import type { Metadata } from "next";
import { Archivo, Source_Code_Pro, Source_Serif_4 } from "next/font/google";
import "./globals.css";

// Three faces, three jobs. Archivo is the instrument: chrome, questions, buttons. Source Serif
// sets the answers, because an answer here is a piece of documentation and reads like one. Source
// Code Pro appears only where the content is literally machine output — similarity scores and
// error codes — and it shares its proportions with Source Serif by design.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
});

const sourceCode = Source_Code_Pro({
  variable: "--font-source-code",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meridian Sync Support",
  description:
    "Ask about Meridian Sync. Answers come from the product documentation, with a link to every section used.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${sourceSerif.variable} ${sourceCode.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
