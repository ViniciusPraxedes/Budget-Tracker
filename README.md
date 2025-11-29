# Budget Tracker

A modern, full-stack Budget Tracker application built with Next.js and Firebase.

## Features

*   **Dashboard**: View a summary of your monthly income, expenses, and savings.
*   **Transaction Management**: Add, edit, and delete expenses.
*   **Category Management**: Create custom categories with color coding.
*   **Analytics**: Visualize your spending habits with interactive charts.
*   **Multi-Month Support**: Navigate between months to track your financial history.
*   **Data Duplication**: Easily copy budget categories and expenses from the previous month.
*   **Authentication**: Secure Google Login integration.
*   **Cloud Sync**: Real-time data persistence using Firestore.
*   **Dark Mode**: Sleek, dark-themed UI inspired by Firebase design.

## Tech Stack

*   **Frontend**: Next.js 14 (App Router), React, TypeScript
*   **Styling**: CSS Modules / Global CSS (Dark Theme)
*   **Backend / Database**: Firebase Firestore
*   **Authentication**: Firebase Authentication (Google Provider)
*   **Deployment**: Firebase App Hosting
*   **Charts**: Recharts

## Getting Started

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/ViniciusPraxedes/Budget-Tracker.git
    cd Budget-Tracker
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Set up Firebase:**
    *   Create a project in the [Firebase Console](https://console.firebase.google.com/).
    *   Enable **Authentication** and set up the **Google** sign-in provider.
    *   Create a **Firestore Database**.
    *   Update `src/firebase.ts` with your Firebase configuration keys.

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

5.  **Open the app:**
    Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## Deployment

This project is configured for **Firebase App Hosting**.
The `apphosting.yaml` file is included in the root directory.

## License

MIT
