const { app, BrowserWindow, shell } = require("electron")
const { spawn } = require("child_process")
const path = require("path")
const http = require("http")

const PORT = 3000
const DEV = process.env.NODE_ENV === "development"

let nextProcess = null
let mainWindow = null

// ── Poll until Next.js is ready ──────────────────────────────────────────────
function waitForServer(url, retries = 30, delay = 1000) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      http.get(url, (res) => {
        if (res.statusCode < 500) resolve()
        else retry()
      }).on("error", retry)
    }
    const retry = () => {
      attempts++
      if (attempts >= retries) return reject(new Error("Next.js server did not start"))
      setTimeout(check, delay)
    }
    check()
  })
}

// ── Start Next.js ────────────────────────────────────────────────────────────
function startNext() {
  const cmd = process.platform === "win32" ? "npx.cmd" : "npx"
  const args = DEV ? ["next", "dev", "--port", PORT] : ["next", "start", "--port", PORT]
  const cwd = DEV ? path.join(__dirname, "..") : path.join(process.resourcesPath, "app")

  nextProcess = spawn(cmd, args, {
    cwd,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "pipe",
  })

  nextProcess.stdout?.on("data", (d) => process.stdout.write(d))
  nextProcess.stderr?.on("data", (d) => process.stderr.write(d))
  nextProcess.on("error", (err) => console.error("Next.js error:", err))
}

// ── Create window ────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#0d0d1a",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, "../public/favicon.ico"),
  })

  mainWindow.loadURL(`http://localhost:${PORT}`)

  // Open external links in browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: "deny" }
  })

  mainWindow.on("closed", () => { mainWindow = null })
}

// ── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  startNext()
  try {
    await waitForServer(`http://localhost:${PORT}`)
    createWindow()
  } catch (err) {
    console.error(err)
    app.quit()
  }
})

app.on("window-all-closed", () => {
  if (nextProcess) nextProcess.kill()
  if (process.platform !== "darwin") app.quit()
})

app.on("activate", () => {
  if (!mainWindow) createWindow()
})

app.on("before-quit", () => {
  if (nextProcess) nextProcess.kill()
})
