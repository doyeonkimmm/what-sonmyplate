import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오늘 뭐 먹지?",
  description: "사진과 손그림으로 남기는 나의 식사 기록",
  openGraph: { title: "오늘 뭐 먹지?", description: "사진과 손그림으로 남기는 나의 식사 기록", images: ["/og.png"] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
