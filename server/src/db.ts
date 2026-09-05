import { sqlite } from "@flue/runtime/node"
import { config } from "./config.js"

export default sqlite(config.flueDbPath)
