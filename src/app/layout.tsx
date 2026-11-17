import type { Metadata } from "next";
import localFont from "next/font/local";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import AppDateProvider from "@/components/AppDateProvider";
import theme from "@/theme";
import "./globals.css";

const roboto = localFont({
  src: "../fonts/roboto-latin.woff2",
  weight: "300 700",
  display: "swap",
  variable: "--font-roboto",
});

export const metadata: Metadata = {
  title: "Medique Admin Manager",
  description: "Admin manager for Medique",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${roboto.variable} h-full`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            <AppDateProvider>{children}</AppDateProvider>
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
