import type { Context, TabResource } from '../types';
import { newContext } from '../utils/context';
const resource = (title: string, url: string): TabResource => ({ id: crypto.randomUUID(), title, url, addedAt: Date.now() });
export function demoContexts(): Context[] {
  return [
    { ...newContext({ name: '秋招 / 百度 AI 产品经理', category: '秋招', status: 'waiting', note: '演示：已投递，等待测评。下一步核对岗位要求。所有页面均为公开入口或占位，不代表真实申请。' }), resources: [
      resource('招聘官网 · 公共入口', 'https://talent.baidu.com/'),
      resource('JD 页面 · 占位', 'https://example.com/?demo=job-description'),
      resource('AI 对话 · 公共入口', 'https://chatgpt.com/'),
      resource('简历文件页面 · 网页占位', 'https://example.com/?demo=resume'),
    ] },
    { ...newContext({ name: '写小说 / 第三卷', category: '创作', status: 'active', note: '演示：第三章停在港口相遇。下次继续整理人物动机。' }), resources: [
      resource('AI 对话 · 公共入口', 'https://chatgpt.com/'),
      resource('世界观资料 · 维基百科', 'https://www.wikipedia.org/'),
      resource('写作音乐 · 公共入口', 'https://music.youtube.com/'),
    ] },
  ];
}
