import { publicAccessError } from "@/lib/request-access";
import {
  compareInterventions,
  effectiveness,
  validEvaluation,
} from "@/lib/effectiveness";
export const runtime = "nodejs";
let busy = false;
let lastCall = 0;
export async function POST(request: Request) {
  const accessError = await publicAccessError(request);
  if (accessError) return accessError;
  if (!process.env.OPENAI_API_KEY)
    return Response.json(
      {
        error:
          "Isi OPENAI_API_KEY di .env lalu restart server. Skor dasar tetap tersedia.",
      },
      { status: 503 },
    );
  if (busy || Date.now() - lastCall < 10000)
    return Response.json(
      { error: "Tunggu 10 detik sebelum evaluasi berikutnya." },
      { status: 429 },
    );
  let input;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw Error();
    let raw = "",
      size = 0;
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 40000) {
        await reader.cancel();
        throw Error();
      }
      raw += decoder.decode(value, { stream: true });
    }
    input = JSON.parse(raw + decoder.decode());
    if (!validEvaluation(input) || effectiveness(input).seconds < 20)
      throw Error();
  } catch {
    return Response.json(
      { error: "Data sesi tidak valid atau durasi kurang dari 20 detik." },
      { status: 400 },
    );
  }
  busy = true;
  lastCall = Date.now();
  const metrics = effectiveness(input);
  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const signal = AbortSignal.timeout(45000);
  const call = async (body: object) => {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        max_output_tokens: 1600,
        ...body,
      }),
    });
    if (!response.ok) throw Error("upstream");
    const result = await response.json();
    if (result.status !== "completed") throw Error("incomplete");
    return result;
  };
  try {
    const instructions =
      "Anda evaluator simulasi cold storage. Jawab Bahasa Indonesia. Nilai efektivitas pendinginan, bukan keberhasilan memicu gangguan. Skor dasar diberikan aplikasi dan tidak boleh diubah. Ini data demo, bukan jaminan keamanan pangan, efisiensi energi atau performa pabrik. Gunakan tool untuk membandingkan intervensi lalu rekomendasikan langkah berikut dan batas bukti. Sensor offline/stale tidak membuktikan pendinginan buruk maupun pulih. Jangan jalankan kontrol perangkat.";
    const messages = [
      { role: "user", content: JSON.stringify({ session: input, metrics }) },
    ];
    const first = await call({
      instructions,
      input: messages,
      tools: [
        {
          type: "function",
          name: "compare_interventions",
          description:
            "Bandingkan 3 intervensi dalam simulator deterministik 120 detik.",
          parameters: {
            type: "object",
            properties: {},
            required: [],
            additionalProperties: false,
          },
          strict: true,
        },
      ],
      tool_choice: { type: "function", name: "compare_interventions" },
      parallel_tool_calls: false,
    });
    const toolCall = first.output?.find(
      (o: { type: string; name?: string }) =>
        o.type === "function_call" && o.name === "compare_interventions",
    );
    if (!toolCall) throw Error("tool");
    const comparisons = compareInterventions(input);
    const final = await call({
      instructions,
      input: [
        ...messages,
        ...first.output,
        {
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: JSON.stringify(comparisons),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "evaluation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["summary", "recommendations", "limitations"],
            properties: {
              summary: { type: "string" },
              recommendations: { type: "array", items: { type: "string" } },
              limitations: { type: "string" },
            },
          },
        },
      },
    });
    const output = final.output
      ?.flatMap(
        (o: { content?: { type: string; text?: string }[] }) => o.content || [],
      )
      .find((c: { type: string }) => c.type === "output_text")?.text;
    const analysis = JSON.parse(output || "{}");
    if (
      typeof analysis.summary !== "string" ||
      typeof analysis.limitations !== "string" ||
      !Array.isArray(analysis.recommendations) ||
      !analysis.recommendations.every((v: unknown) => typeof v === "string")
    )
      throw Error("format");
    return Response.json({
      metrics,
      analysis,
      comparisons,
      model,
      evaluatedAt: new Date().toISOString(),
    });
  } catch {
    return Response.json(
      {
        error:
          "Evaluasi AI gagal. Periksa API key, akses model, saldo API, atau coba kembali. Skor dasar tidak berubah.",
      },
      { status: 502 },
    );
  } finally {
    busy = false;
  }
}
