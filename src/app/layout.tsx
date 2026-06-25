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

// Export viewport configuration for Next.js layout
export const viewport = {
    // Set the viewport width to device width
    width: "device-width",
    // Set the initial scale to 1
    initialScale: 1,
    // Set viewport-fit to cover to enable safe-area insets
    viewportFit: "cover",
// End of viewport configuration object
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
