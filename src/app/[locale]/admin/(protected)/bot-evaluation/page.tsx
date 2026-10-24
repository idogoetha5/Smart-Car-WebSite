import WhatsAppSimulator from '@/components/whatsapp/WhatsAppSimulator';

export const metadata = { robots: { index: false, follow: false } };

export default function BotEvaluationPage() {
  return <WhatsAppSimulator endpoint="/api/admin/whatsapp/model-evaluation" title="בדיקה פנימית — Gemini 3.8" />;
}
