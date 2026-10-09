import { useState } from 'react';
import { Modal } from './ReviewDialog';

// Temporary research scaffolding; remove with storage/usage.ts after user research.
export function UsageExport({ initial, onClose }: { initial: string; onClose: () => void }) {
  const [content, setContent] = useState(initial);
  const [error, setError] = useState('');
  function download() {
    try { JSON.parse(content); } catch { setError('请保留有效的 JSON 格式；可以删除条目或改成空数组 []。'); return; }
    const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = 'context-usage-events.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onClose();
  }
  return <Modal title="检查并导出研究记录" busy={false} onCancel={onClose}>
    <p className="helper">这是临时研究记录。下面是本次导出的完整内容，你可以编辑或删除任意条目。点击导出后，只下载此处的内容。</p>
    <label htmlFor="usage-events">导出内容<textarea id="usage-events" name="usage-events" rows={16} value={content} onChange={e => { setContent(e.target.value); setError(''); }} spellCheck={false} /></label>
    {error && <p role="alert">{error}</p>}
    <div className="button-row"><button onClick={download}>导出编辑后的 JSON</button><button onClick={onClose}>取消</button></div>
  </Modal>;
}
