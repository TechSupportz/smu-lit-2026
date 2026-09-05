import { Download, FileText, LoaderCircle, Trash2, AlertCircle } from 'lucide-react'
import { Button } from './ui/button'
import { downloadFile, removeBlob } from '@/lib/storage'
import { useCase } from '@/lib/store'
import type { CaseFile } from '@/lib/types'
export function FileCard({file, compact=false, onError}:{file:CaseFile;compact?:boolean;onError:(message:string)=>void}) {
 const removeFile=useCase(s=>s.removeFile)
 return <div className={`file-card ${compact?'compact':''}`}>
  <span className="file-symbol"><FileText size={19}/></span>
  <div className="file-info"><strong title={file.name}>{file.name}</strong><span>{file.status==='generating'?'Preparing your document…':file.status==='failed'?(file.error??'Could not prepare file'):`${Math.max(1,Math.round(file.size/1024))} KB · ${file.kind==='generated'?'Sample PDF':'Saved on this device'}`}</span></div>
  {file.status==='generating'?<LoaderCircle size={17} className="spin"/>:file.status==='failed'?<AlertCircle size={17}/>:<Button variant="ghost" size="icon" aria-label={`Download ${file.name}`} onClick={()=>downloadFile(file.id,file.name).catch(e=>onError(e.message))}><Download size={16}/></Button>}
  {file.kind==='evidence'&&!compact&&<Button variant="ghost" size="icon" aria-label={`Remove ${file.name}`} onClick={async()=>{try{await removeBlob(file.id);removeFile(file.id)}catch{onError('Could not remove this file. Please try again.')}}}><Trash2 size={15}/></Button>}
 </div>
}
