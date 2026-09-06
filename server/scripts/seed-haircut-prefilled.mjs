import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import process from "node:process"

const baseUrl = (process.env.PREFILLED_API_BASE_URL ?? "http://127.0.0.1:3000").replace(
    /\/$/,
    "",
)
const outputDirectory = resolve(
    process.cwd(),
    process.env.PREFILLED_OUTPUT_DIR ?? "../demo/output",
)

const response = await globalThis.fetch(`${baseUrl}/prefilled/scenarios/haircut-package`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idempotencyKey: `haircut-prefilled-script-${Date.now()}` }),
})
if (!response.ok) {
    throw new Error(`Prefilled case seed failed (${response.status}): ${await response.text()}`)
}

const state = await response.json()
await mkdir(outputDirectory, { recursive: true })
const manifestPath = resolve(outputDirectory, "haircut-prefilled-state.json")
await writeFile(manifestPath, `${JSON.stringify(state, null, 2)}\n`)

globalThis.console.log(`Seeded prefilled haircut case ${state.case.id}`)
globalThis.console.log(`State manifest written to ${manifestPath}`)
globalThis.console.log(
    "No PDFs were generated. Request them through the Flue harness from the connected frontend.",
)
