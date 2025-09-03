import "./globals.css";

// Metadata biasa
export const metadata = {
  title: "FABARO Radio Online",
  description: "Streaming radio dunia - cari, putar, favorit, sleep timer."
};

// Viewport RESMI Next.js → lebih stabil di Android
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#0b0b0b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      {/* Kunci lebar & cegah scroll horizontal */}
      <body className="bg-black text-white min-h-screen w-full overflow-x-hidden">
        {children}
      </body>
    </html>
  );
}
