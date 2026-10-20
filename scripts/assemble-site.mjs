import { cp, mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const site = path.join(root, "site")

await rm(site, { recursive: true, force: true })
await mkdir(site, { recursive: true })
await cp(path.join(root, "landing", "dist"), site, { recursive: true })
await cp(path.join(root, "index.html"), path.join(site, "tracker.html"))
await cp(path.join(root, "css"), path.join(site, "css"), { recursive: true })
await cp(path.join(root, "js"), path.join(site, "js"), { recursive: true })
