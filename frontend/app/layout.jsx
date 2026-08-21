import './globals.css';

export const metadata = {
  title: 'Voice RAG Sound Console',
  description: 'Ultra low-latency Voice-Enabled RAG pipeline powered by Sarvam STT, Multi-Strategy Chunking, Qdrant Vector Search, and Grounded Generation in under 200ms.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;600;700&family=Plus+Jakarta+Sans:wght@500;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
