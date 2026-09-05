import { createStore, del, get, set } from "idb-keyval"
const files = createStore("claimguide-files", "files")
export const saveBlob = (id: string, blob: Blob) => set(id, blob, files)
export const readBlob = (id: string) => get<Blob>(id, files)
export const removeBlob = (id: string) => del(id, files)
export async function downloadFile(id: string, name: string) {
    const blob = await readBlob(id)
    if (!blob)
        throw new Error("This file is no longer available on this browser. Please attach it again.")
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = name
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
}
