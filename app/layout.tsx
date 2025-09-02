export const metadata = {
  title: "FABARO Radio Online",
  description: "Streaming radio dunia - cari, putar, favorit, sleep timer."
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/icon-192.png" />
        <meta name="theme-color" content="#0b0b0b" />
      </head>
      <body>{children}</body>
    </html>
  );
}
