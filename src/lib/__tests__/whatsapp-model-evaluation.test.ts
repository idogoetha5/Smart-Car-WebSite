import { afterEach, describe, expect, it, vi } from 'vitest';
const incident = vi.hoisted(() => vi.fn());
vi.mock('@/lib/whatsapp-incidents', () => ({ reportBotIncident:incident }));
import { activeModelEvaluation, evaluateGeminiModel } from '@/lib/whatsapp-model-evaluation';
import { freeModelChain, generateSmartCarContent, resetModelCooldowns, withModelChain } from '@/lib/whatsapp-gemini-client';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); resetModelCooldowns(); });
describe('private model comparison isolation', () => {
  it('does not suppress a later real missing-key alert after a private failed test', async () => {
    vi.stubEnv('GEMINI_API_KEY',''); vi.stubEnv('WHATSAPP_GEMINI_API_KEY','');
    resetModelCooldowns();
    await evaluateGeminiModel(()=>generateSmartCarContent({model:freeModelChain()[0],body:{}}));
    expect(incident).not.toHaveBeenCalled();
    await generateSmartCarContent({model:'gemini-3.5-flash-lite',body:{}});
    expect(incident).toHaveBeenCalledExactlyOnceWith('ai_unavailable');
  });
  it('does not allow public diagnostic headers to switch to the private model', async () => {
    expect(await withModelChain(['gemini-3.8-flash'],async()=>freeModelChain())).toEqual(['gemini-3.5-flash-lite']);
    expect(activeModelEvaluation()).toBeUndefined();
  });
  it('does not leak its model to a concurrent normal request', async () => {
    let release!:()=>void;
    const gate=new Promise<void>(resolve=>{release=resolve;});
    const pending=evaluateGeminiModel(async()=>{await gate; return freeModelChain();});
    expect(freeModelChain()).toEqual(['gemini-3.5-flash-lite']);
    release();
    expect((await pending).result).toEqual(['gemini-3.8-flash']);
    expect(freeModelChain()).toEqual(['gemini-3.5-flash-lite']);
  });
  it('records numeric usage and uses supported low thinking without mutating the original prompt', async () => {
    vi.stubEnv('GEMINI_API_KEY','fictional-key');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({usageMetadata:{promptTokenCount:100,candidatesTokenCount:20,thoughtsTokenCount:5},candidates:[{content:{parts:[{text:'valid'}]}}]}))));
    const body={generationConfig:{maxOutputTokens:1500},contents:[]};
    const result=await evaluateGeminiModel(()=>generateSmartCarContent({model:freeModelChain()[0],body}));
    expect(result.evaluation.usage).toEqual({inputTokens:100,outputTokens:20,thinkingTokens:5});
    expect(JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string).generationConfig.thinkingConfig).toEqual({thinkingLevel:'low'});
    expect(body.generationConfig).toEqual({maxOutputTokens:1500});
  });
  it('does not announce a production outage when a private comparison fails', async () => {
    vi.stubEnv('GEMINI_API_KEY','fictional-key');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:503})));
    const result=await evaluateGeminiModel(()=>generateSmartCarContent({model:freeModelChain()[0],body:{}}));
    expect(result.result).toMatchObject({ok:false,status:503});
    expect(incident).not.toHaveBeenCalled();
    expect(freeModelChain()).toEqual(['gemini-3.5-flash-lite']);
  });
});
