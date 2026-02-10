# Ultron Developments IT Solution Template - Deployment Guide

This comprehensive guide details the architecture, setup, and deployment process for the **Ultron Developments IT Solution Template**. This application works as a Service Desk / Ticketing system built on the `Power Apps Code` platform, featuring a modern, responsive UI that works seamlessly across Desktop and Mobile devices.

---

## 🚀 Key Features

*   **Modern Design**: A premium, clean user interface with a custom Indigo/Purple theme, pill-shaped buttons, and glassmorphism effects.
*   **Responsive Layout**: 
    *   **Desktop**: Fixed sidebar navigation with a centered,max-width constrained content area for optimal readability.
    *   **Mobile**: Collapsible drawer navigation, touch-friendly list views, and adaptive forms.
*   **Ticket Management**: Create, Read, and Update support tickets with Priority and Status tracking.
*   **User Integration**: Integrated Office 365 User Search for assigning tickets to users in your organization.
*   **Contact Us Module**: a dedicated page showcasing Ultron Developments services, featuring a hero section and service cards including "Power Apps Code Apps".
*   **Dark Mode**: Built-in theme toggling preference.

---

## 🛠️ Prerequisites

Before deploying this solution, ensure your environment meets the following requirements:

1.  **Metric Power Platform Environment**:
    *   Must have **Dataverse** provisioned.
    *   Must have **Code Components** enabled (System Settings).

2.  **Dataverse Table (`cr76d_ticket`)**:
    The application relies on a custom table for storing tickets. Ensure this table exists with the following columns:
    *   **Display Name**: Ticket
    *   **Logical Name**: `cr76d_ticket`
    *   **Columns**:
        *   `cr76d_tickettitle` (Text, Primary Name)
        *   `cr76d_description` (Multiple Line Text)
        *   `cr76d_priority` (Choice) - Options: Low, Medium, High
        *   `cr76d_status` (Choice) - Options: Open, In Progress, Closed
        *   `cr76d_ticketowner` (Text) - Stores the Office 365 Email of the assignee.

3.  **Development Tools**:
    *   **Node.js** (LTS version recommended)
    *   **Power Platform CLI (PAC)** installed via VS Code extension or standalone installer.
    *   **VS Code** (or preferred code editor).

---

## 📦 Installation & Deployment

Follow these steps to deploy the solution to your Power Platform environment.

### 1. Authenticate
Open your terminal and authenticate with your Power Platform environment.

```powershell
pac auth create
pac env select --environment <YOUR_ENVIRONMENT_ID>
```

### 2. Install Dependencies
Navigate to the project directory and install the necessary Node.js packages.

```powershell
cd service-desk-app
npm install
```

### 3. Build the Application
Compile the TypeScript and bundled assets for production.

```powershell
npm run build
```

### 4. Deploy (Push) to Dataverse
Use the Power Platform CLI to push the application code to your selected environment.

```powershell
pac code push
```

*Note: If this is the first time deploying, `pac code push` will register the application. If updating, it will upload a new version to the existing App ID defined in `power.config.json`.*

### 5. Play the App
Once deployed, the terminal will provide a `play` URL. Open this in your browser to launch the application.

---

## 💻 Local Development

To run the application locally for testing and development without deploying every change:

1.  Start the local development server:
    ```powershell
    npm run dev
    ```
2.  Open the provided **Local Play URL** in your browser. This proxies the Dataverse connection, allowing you to interact with real data while modifying UI code locally.

---

## 🎨 Customization Guide

### Branding
*   **Logo/Title**: Edit `src/App.tsx` to change the "Ultron Devs" logo text or the Dashboard header title.
*   **Colors**: Modify `src/index.css` to update the CSS Variables (e.g., `--primary-color`, `--bg-color`) to match your brand identity.

### Navigation
The sidebar navigation is defined in `src/App.tsx`. You can add new links by:
1.  Creating a new `view` state option (e.g., `'new_page'`).
2.  Adding a nav link in the `<nav>` section.
3.  Adding a conditional render block in the `<main>` section for your new page content.

### Ticket Logic
The core logic for fetching and updating tickets resides in `src/App.tsx` within the `loadTickets` and `handleSaveTicket` functions. These utilize the generated service classes in `src/generated/services/`.

---

## ⚠️ Troubleshooting

**Issue: "Update failed" when saving a ticket**
*   **Cause**: This often happens if the payload includes system fields like `ownerid` or `statecode` that cannot be written to directly via the API.
*   **Fix**: Ensure the `handleSaveTicket` function explicitly constructs a payload containing *only* the editable fields (`cr76d_tickettitle`, `cr76d_description`, etc.).

**Issue: Application looks broken on Desktop**
*   **Cause**: CSS Grid or Flexbox issues.
*   **Fix**: The app uses a `.content-wrapper` class to constrain width on large screens. Ensure `App.css` defines `.main-content` as `display: block` and `.content-wrapper` with `margin: 0 auto`.

**Issue: Contact Us page links don't work**
*   **Fix**: Ensure `target="_blank"` and `rel="noopener noreferrer"` are present on external `<a>` tags for security and correct behavior.

---


## 📜 Release Notes

### v1.2.5 (Current Release)
*   **Pagination Improvements**:
    *   Switched from `top` to `maxPageSize` for reliable Dataverse pagination.
    *   Implemented robust `skipToken` extraction logic to handle large datasets (>50 records).
    *   Fixed "No nextLink" errors when navigating through multiple pages.
*   **Contact Us Page Redesign**:
    *   Updated layout with increased spacing for better readability.
    *   Added "Power Apps Code Apps" to the service offerings.
    *   Removed "Full platform overview" button and condensed the feature list.
*   **General**:
    *   Updated footer version display.
    *   Removed legacy "Contacts" view and navigation links.

---

**Developed solely for Ultron Developments.**
