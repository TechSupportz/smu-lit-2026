import { useLayoutEffect, type RefObject } from "react"

/**
 * Grows a textarea from its own `scrollHeight` up to `max` pixels, then scrolls
 * internally. Runs synchronously after commit so typing never lags the caret.
 * `field-sizing: content` in CSS is a progressive enhancement on top of this.
 */
export function useAutoGrow(
    ref: RefObject<HTMLTextAreaElement | null>,
    value: string,
    max: number,
) {
    useLayoutEffect(() => {
        const field = ref.current
        if (!field) return
        field.style.height = "auto"
        const content = field.scrollHeight
        field.style.height = `${Math.min(content, max)}px`
        field.style.overflowY = content > max ? "auto" : "hidden"
    }, [ref, value, max])
}
