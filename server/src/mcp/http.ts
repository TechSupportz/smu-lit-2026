import { timingSafeEqual } from "node:crypto"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import type { Context } from "hono"
import type { AppConfig } from "../config.js"
import {
    createClaimGuideMcpServer,
    type ClaimGuideMcpDependencies,
} from "./server.js"

function sameToken(candidate: string, expected: string): boolean {
    const candidateBytes = Buffer.from(candidate)
    const expectedBytes = Buffer.from(expected)
    return (
        candidateBytes.length === expectedBytes.length &&
        timingSafeEqual(candidateBytes, expectedBytes)
    )
}

export function isMcpAuthorized(authorization: string | undefined, accessToken: string): boolean {
    if (!accessToken) return true
    if (!authorization?.startsWith("Bearer ")) return false
    return sameToken(authorization.slice("Bearer ".length), accessToken)
}

export async function handleMcpRequest(
    context: Context,
    dependencies: ClaimGuideMcpDependencies,
    config: Pick<AppConfig, "mcpEnabled" | "mcpAccessToken">,
): Promise<Response> {
    if (!config.mcpEnabled) {
        return context.json(
            {
                error: {
                    code: "MCP_DISABLED",
                    message: "The MCP endpoint is disabled on this server.",
                    details: null,
                },
            },
            404,
        )
    }
    if (!isMcpAuthorized(context.req.header("authorization"), config.mcpAccessToken)) {
        return context.json(
            {
                error: {
                    code: "UNAUTHORIZED",
                    message: "A valid bearer token is required for this MCP endpoint.",
                    details: null,
                },
            },
            401,
            { "WWW-Authenticate": "Bearer" },
        )
    }

    const transport = new WebStandardStreamableHTTPServerTransport()
    const server = createClaimGuideMcpServer(dependencies)
    await server.connect(transport)
    return transport.handleRequest(context.req.raw)
}
