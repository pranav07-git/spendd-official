import { initLlama } from 'llama.rn';
import { AI_RESPONSE_SCHEMA, buildMessages, parseAiInsights } from './aiPrompt';
import type { Insight } from './types';

// Generations run one after another: the phone has room for one model in memory at a time.
let queue: Promise<unknown> = Promise.resolve();

async function run(modelPath: string, facts: string): Promise<Insight[]> {
  const context = await initLlama({ model: modelPath, n_ctx: 2048, n_gpu_layers: 0, use_mlock: false });
  try {
    const result = await context.completion({
      messages: buildMessages(facts),
      jinja: true,
      n_predict: 700,
      temperature: 0.5,
      top_p: 0.9,
      response_format: { type: 'json_schema', json_schema: { strict: true, schema: AI_RESPONSE_SCHEMA } },
    });
    return parseAiInsights(result.text, facts);
  } finally {
    // Frees the ~700 MB the model used; reloading takes a second or two next time.
    await context.release();
  }
}

/** Loads the model, writes insights from `facts`, and unloads it again. */
export function generateAiInsights(modelPath: string, facts: string): Promise<Insight[]> {
  const job = queue.then(() => run(modelPath, facts));
  queue = job.catch(() => undefined);
  return job;
}
