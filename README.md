# CP Alert Dashboard Automation

Automation script for CP Alert Dashboard.

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Visual Studio Code](https://code.visualstudio.com/)

---

## Steps to Run the Automation Script

### 1. Open Project in VS Code
Open the folder **`cp-alert-dashboard-automation-main`** in Visual Studio Code:
- Launch VS Code.
- Go to **File** > **Open Folder...** and select `cp-alert-dashboard-automation-main`.

### 2. Verify Working Directory
Open an integrated terminal in VS Code (`Ctrl + \`` or **Terminal** > **New Terminal**), then verify you are in the project root directory:

```bash
pwd
```

Ensure the output path ends with `cp-alert-dashboard-automation-main`.

### 3. Install Dependencies
Install the required npm dependencies by running:

```bash
npm install
```

Wait for the installation to finish successfully.

### 4. Run the Script
Once dependencies are installed, start the authentication setup script:

```bash
npx tsx .\tests\auth.setup.ts
```

*(Note: On macOS/Linux or bash shells, you can also run `npx tsx ./tests/auth.setup.ts`)*

### 5. Stop the Script
To stop or terminate the running script at any point, press:

```text
Ctrl + C
```
