import type { Metadata } from "next";
import { anton, inter } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThumbStudio · Miniaturas con el estilo de los videos que más funcionan",
  description:
    "Pega un canal de YouTube: estudiamos el estilo de sus miniaturas más vistas y generamos miniaturas para tu video con tus modelos locales o tus API keys.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${inter.variable} ${anton.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
