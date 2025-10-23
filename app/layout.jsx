import './globals.css';

export const metadata = {
  title: 'Loremaker',
  description: 'Loremaker Application',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
