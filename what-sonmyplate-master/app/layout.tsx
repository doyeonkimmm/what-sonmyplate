import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "오늘모먹지",
  description: "사진으로 이어 보는 나와 친구들의 하루 한 끼 기록장",
  openGraph: {
    title: "오늘모먹지",
    description: "사진으로 이어 보는 나와 친구들의 하루 한 끼 기록장",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fdfdfb",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}</body></html>;
}
