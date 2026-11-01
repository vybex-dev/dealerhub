import "./globals.css";
export const metadata = { title: "DealerHub", description: "Your own branded property website, live in minutes." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
