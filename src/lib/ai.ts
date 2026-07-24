import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "./db";
import { getAnthropicKey, getSettings } from "./settings";

// One entry point for every AI feature. Routes to the local MLX server
// (OpenAI-compatible, free, private) or the Anthropic API depending on the
// provider chosen in settings, and records every generation in the spend
// ledger. Local generations cost 0; Anthropic costs are computed from real
// token usage at the model's published rates.
export type AiResult = {
  text: string;
  provider: "local" | "anthropic";
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
};

// $ per million tokens (input, output)
const ANTHROPIC_PRICING: Record<string, [number, number]> = {
  "claude-opus-4-8": [5, 25],
  "claude-sonnet-4-6": [3, 15],
  "claude-haiku-4-5": [1, 5],
};

function anthropicCostCents(model: string, inTok: number, outTok: number): number {
  const [inRate, outRate] = ANTHROPIC_PRICING[model] ?? [5, 25];
  return ((inTok * inRate + outTok * outRate) / 1_000_000) * 100;
}

function recordSpend(feature: string, r: AiResult): void {
  getDb()
    .prepare(
      `INSERT INTO ai_spend (created_at, feature, provider, model, input_tokens, output_tokens, cost_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(Date.now(), feature, r.provider, r.model, r.inputTokens, r.outputTokens, r.costCents);
}

async function chatLocal(
  system: string,
  user: string,
  maxTokens: number
): Promise<AiResult> {
  const { ai } = getSettings();
  const res = await fetch(`${ai.localUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ai.localModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.4,
    }),
    signal: AbortSignal.timeout(300_000),
  });
  if (!res.ok) {
    throw new Error(`local model returned ${res.status}. is the mlx server running?`);
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("local model returned an empty response");
  return {
    text,
    provider: "local",
    model: ai.localModel,
    inputTokens: data?.usage?.prompt_tokens ?? 0,
    outputTokens: data?.usage?.completion_tokens ?? 0,
    costCents: 0,
  };
}

async function chatAnthropic(
  system: string,
  user: string,
  maxTokens: number
): Promise<AiResult> {
  const { ai } = getSettings();
  const apiKey = getAnthropicKey();
  if (!apiKey) throw new Error("no anthropic api key saved. add one in settings");
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: ai.anthropicModel,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");
  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  return {
    text,
    provider: "anthropic",
    model: ai.anthropicModel,
    inputTokens,
    outputTokens,
    costCents: anthropicCostCents(ai.anthropicModel, inputTokens, outputTokens),
  };
}

export async function chat(
  feature: string,
  system: string,
  user: string,
  maxTokens = 2048
): Promise<AiResult> {
  const { ai } = getSettings();
  const result =
    ai.provider === "anthropic"
      ? await chatAnthropic(system, user, maxTokens)
      : await chatLocal(system, user, maxTokens);
  recordSpend(feature, result);
  return result;
}

// settings page "test connection": verifies the active provider is reachable
export async function verifyAi(): Promise<{ ok: boolean; detail?: string; error?: string }> {
  const { ai } = getSettings();
  try {
    if (ai.provider === "local") {
      const res = await fetch(`${ai.localUrl}/models`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) throw new Error(`server returned ${res.status}`);
      return { ok: true, detail: `mlx server is up at ${ai.localUrl}` };
    }
    const apiKey = getAnthropicKey();
    if (!apiKey) return { ok: false, error: "enter an anthropic api key first" };
    const client = new Anthropic({ apiKey });
    const model = await client.models.retrieve(ai.anthropicModel);
    return { ok: true, detail: `connected, ${model.display_name} ready` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const friendly =
      ai.provider === "local"
        ? `couldn't reach the local model at ${ai.localUrl}. start it with: mlx_lm.server --model ${ai.localModel} --port 8080`
        : /401|authentication/i.test(msg)
          ? "anthropic rejected the key. check it in settings"
          : `couldn't reach anthropic: ${msg.slice(0, 120)}`;
    return { ok: false, error: friendly };
  }
}

export function spendTotals(): {
  totalCents: number;
  byFeature: { feature: string; n: number; cents: number }[];
} {
  const db = getDb();
  const total = db.prepare("SELECT COALESCE(SUM(cost_cents), 0) AS c FROM ai_spend").get() as {
    c: number;
  };
  const byFeature = db
    .prepare(
      `SELECT feature, COUNT(*) AS n, COALESCE(SUM(cost_cents), 0) AS cents
       FROM ai_spend GROUP BY feature ORDER BY cents DESC`
    )
    .all() as { feature: string; n: number; cents: number }[];
  return { totalCents: total.c, byFeature };
}
