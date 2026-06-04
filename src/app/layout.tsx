import type { Metadata } from "next";
// Import Viewport metadata types from NextJS core
import type { Viewport } from "next";
import "./globals.css";
import { BudgetProvider } from "@/context/BudgetContext";
import { AuthProvider } from "@/context/AuthContext";

import { ToastProvider } from "@/context/ToastContext";
import { LocalizationProvider } from "@/context/LocalizationContext";
import ErrorBoundary from "@/components/ErrorBoundary";

export const metadata: Metadata = {
    title: "Budget Tracker",
    description: "Track your expenses and savings",
};

// Export viewport configurations matching theme and device boundaries
export const viewport: Viewport = {
    // Match theme color background value
    themeColor: "#0A0A0A",
    // Match responsive view width scale settings
    width: "device-width",
    // Configure default zoom scale parameter value
    initialScale: 1,
    // Cover the full layout space around notch screen offsets
    viewportFit: "cover",
// Terminate viewport object structure declaration definition
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
                {/* Set iOS status bar translucent style content overlay */}
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
            </head>
            <body suppressHydrationWarning>
                <ErrorBoundary>
                    <ToastProvider>
                        <LocalizationProvider>
                            <AuthProvider>
                                <BudgetProvider>
                                    {children}
                                </BudgetProvider>
                            </AuthProvider>
                        </LocalizationProvider>
                    </ToastProvider>
                </ErrorBoundary>
            </body>
        </html>
    );
}
