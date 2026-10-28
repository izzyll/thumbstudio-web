import { Anton, Inter } from "next/font/google";

export const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Also the font of the titles drawn on the thumbnails (lib/image.ts addText).
export const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });
