import type { AppConfig } from "../config.js"

const SOURCES = {
    eligibility: "https://www.judiciary.gov.sg/civil/cases-eligible-small-claim",
    filing: "https://www.judiciary.gov.sg/civil/how-to-file-serve-small-claim",
    statutes: "https://sso.agc.gov.sg/Act/SCTA1984",
} as const

const allowedHosts = new Set(["www.judiciary.gov.sg", "judiciary.gov.sg", "sso.agc.gov.sg"])

export interface GuidanceResult {
    query: string
    checkedAt: string
    retrievalStatus: "RETRIEVED" | "FAILED"
    sources: Array<{
        url: string
        status: "RETRIEVED" | "FAILED"
        excerpts: string[]
        error?: string
    }>
    notice?: string
}

function assertAllowed(url: URL): void {
    if (url.protocol !== "https:" || !allowedHosts.has(url.hostname.toLowerCase())) {
        throw new Error("Official-guidance redirect left the configured allowlist")
    }
}

function decodeEntities(value: string): string {
    return value
        .replace(/&nbsp;/gi, " ")
        .replace(/&amp;/gi, "&")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
}

function htmlToText(html: string): string {
    return decodeEntities(
        html
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
            .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
            .replace(/<[^>]+>/g, " "),
    )
        .replace(/\s+/g, " ")
        .trim()
}

function excerpts(text: string, query: string): string[] {
    const terms = query
        .toLowerCase()
        .split(/\W+/)
        .filter(term => term.length >= 3)
        .slice(0, 12)
    if (terms.length === 0) return text ? [text.slice(0, 700)] : []
    const lower = text.toLowerCase()
    const hits: string[] = []
    for (const term of terms) {
        let from = 0
        while (hits.length < 8) {
            const index = lower.indexOf(term, from)
            if (index < 0) break
            const start = Math.max(0, index - 220)
            const end = Math.min(text.length, index + term.length + 420)
            const item = text.slice(start, end).trim()
            if (!hits.some(existing => existing.includes(item) || item.includes(existing)))
                hits.push(item)
            from = index + term.length
        }
    }
    return hits
}

async function fetchAllowed(
    urlValue: string,
    timeoutMs: number,
): Promise<{ url: string; text: string }> {
    let url = new URL(urlValue)
    for (let redirect = 0; redirect <= 3; redirect += 1) {
        assertAllowed(url)
        const response = await fetch(url, {
            redirect: "manual",
            signal: AbortSignal.timeout(timeoutMs),
            headers: { "User-Agent": "smu-lit-sct-prefiling/0.1 official-guidance-retriever" },
        })
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get("location")
            if (!location) throw new Error("Official source returned a redirect without a location")
            url = new URL(location, url)
            continue
        }
        if (!response.ok) throw new Error(`Official source returned HTTP ${response.status}`)
        const contentType = response.headers.get("content-type") ?? ""
        if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
            throw new Error(
                `Official source returned unsupported content type ${contentType || "unknown"}`,
            )
        }
        const body = await response.text()
        if (body.length > 5_000_000)
            throw new Error("Official source exceeded the response size bound")
        return { url: url.toString(), text: htmlToText(body) }
    }
    throw new Error("Official source exceeded the redirect limit")
}

export class GuidanceService {
    constructor(private readonly appConfig: AppConfig) {}

    async search(
        query: string,
        sourceNames: Array<keyof typeof SOURCES> = ["eligibility", "filing", "statutes"],
    ): Promise<GuidanceResult> {
        const uniqueSources = [...new Set(sourceNames)]
        const results: GuidanceResult["sources"] = []
        for (const sourceName of uniqueSources) {
            const source = SOURCES[sourceName]
            try {
                const response = await fetchAllowed(
                    source,
                    Math.min(this.appConfig.providerTimeoutMs, 20_000),
                )
                results.push({
                    url: response.url,
                    status: "RETRIEVED",
                    excerpts: excerpts(response.text, query),
                })
            } catch (error) {
                results.push({
                    url: source,
                    status: "FAILED",
                    excerpts: [],
                    error: error instanceof Error ? error.message : "Unknown retrieval error",
                })
            }
        }
        const allRetrieved = results.every(result => result.status === "RETRIEVED")
        return {
            query,
            checkedAt: new Date().toISOString(),
            retrievalStatus: allRetrieved ? "RETRIEVED" : "FAILED",
            sources: results,
            ...(allRetrieved
                ? {}
                : {
                      notice: "Relevant official guidance could not be fully checked. Treat affected procedural conclusions as UNVERIFIED.",
                  }),
        }
    }
}
