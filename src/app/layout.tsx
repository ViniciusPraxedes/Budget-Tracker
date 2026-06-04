import type { Metadata } from "next";
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

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
                {/* Set theme color for browser navigation header status bar */}
                <meta name="theme-color" content="#0A0A0A" />
                {/* Set viewport scaling boundaries and enable notch coverage fit */}
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
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
