export const metadata = {
  title: 'HHG Task 2 — Voice RAG | Team AtoZ',
  description: 'Voice-enabled RAG demo scaffold',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  );
}
