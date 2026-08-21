import './globals.css';

export const metadata = {
  title: 'Hacker गोवा House · Voice RAG',
  description:
    'Voice-enabled RAG for HHG Task 2 — Sarvam STT, multi-strategy chunking, Qdrant retrieval, grounded generation.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body>{children}</body>
    </html>
  );
}
