// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "FABARO Radio Online",
  description: "Streaming radio dunia - cari, putar, favorit, sleep timer."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        {/* PWA & Icon */}
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.png" />
        <meta name="theme-color" content="#0b0b0b" />

        {/* Mobile meta */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />

        {/* iOS PWA fullscreen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="bg-black text-white">{children}</body>
    </html>
  );
}
