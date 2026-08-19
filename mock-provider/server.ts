import express from "express";

const app = express();
app.use(express.json());

const PORT = 4000;

// Scenario is picked via header so test scripts can force each path without
// touching the prompt/model. Real provider requests never send this header,
// so default behavior (no header) is always the success path. Shared by
// both the Anthropic and OpenAI mock endpoints below.
type Scenario = "success" | "error" | "hang";

function pickScenario(req: express.Request): Scenario {
  const s = req.header("x-mock-scenario");
  if (s === "error" || s === "hang") return s;
  return "success";
}

const FAKE_RESPONSE_TEXT =
  "This is a mock response from Silvox's local test provider. " +
  "It exists so proxy plumbing can be built and tested without spending real API credits.";

function fakeUsage() {
  // Rough, deterministic-ish numbers — good enough for testing cost-calc
  // logic, not meant to match real tokenizer output.
  const input_tokens = 24;
  const output_tokens = Math.ceil(FAKE_RESPONSE_TEXT.split(" ").length * 1.3);
  return { input_tokens, output_tokens };
}

// ============================================================
// Anthropic-shaped mock — POST /v1/messages
// ============================================================

app.post("/v1/messages", (req, res) => {
  const scenario = pickScenario(req);
  const model = req.body?.model ?? "mock-model";
  const stream = req.body?.stream === true;

  if (scenario === "hang") {
    // Never respond. Client/proxy must enforce its own timeout — this
    // scenario exists specifically to prove that fail-fast logic works.
    return;
  }

  if (scenario === "error") {
    res.status(500).json({
      type: "error",
      error: {
        type: "api_error",
        message: "mock forced 500 for error-path testing",
      },
    });
    return;
  }

  const usage = fakeUsage();

  if (!stream) {
    res.status(200).json({
      id: "msg_mock_" + Date.now(),
      type: "message",
      role: "assistant",
      model,
      content: [{ type: "text", text: FAKE_RESPONSE_TEXT }],
      stop_reason: "end_turn",
      usage,
    });
    return;
  }

  // --- Streaming (SSE), matching Anthropic's event shape ---

  res.socket?.setNoDelay(true);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const messageId = "msg_mock_" + Date.now();

  send("message_start", {
    type: "message_start",
    message: {
      id: messageId,
      type: "message",
      role: "assistant",
      model,
      content: [],
      stop_reason: null,
      usage: { input_tokens: usage.input_tokens, output_tokens: 0 },
    },
  });

  send("content_block_start", {
    type: "content_block_start",
    index: 0,
    content_block: { type: "text", text: "" },
  });

  const words = FAKE_RESPONSE_TEXT.split(" ");
  let i = 0;
  const interval = setInterval(() => {
    if (i >= words.length) {
      clearInterval(interval);

      send("content_block_stop", { type: "content_block_stop", index: 0 });
      send("message_delta", {
        type: "message_delta",
        delta: { stop_reason: "end_turn", stop_sequence: null },
        usage: { output_tokens: usage.output_tokens },
      });
      send("message_stop", { type: "message_stop" });
      res.end();
      return;
    }
    const chunk = (i === 0 ? "" : " ") + words[i];
    send("content_block_delta", {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: chunk },
    });
    i++;
  }, 20);

  res.on("close", () => clearInterval(interval));
});

// ============================================================
// OpenAI-shaped mock — POST /v1/chat/completions
// ============================================================

app.post("/v1/chat/completions", (req, res) => {
  const scenario = pickScenario(req);
  const model = req.body?.model ?? "mock-model";
  const stream = req.body?.stream === true;
  // Real OpenAI only sends a usage chunk in streaming mode if the client
  // explicitly asks for it via stream_options.include_usage — Silvox's
  // OpenAI adapter always sets this, but the mock honors the flag either
  // way so it accurately reflects real provider behavior (including what
  // happens if some other client hits this route without the flag set).
  const includeUsage = req.body?.stream_options?.include_usage === true;

  if (scenario === "hang") {
    return;
  }

  if (scenario === "error") {
    res.status(500).json({
      error: {
        message: "mock forced 500 for error-path testing",
        type: "api_error",
        code: "mock_forced_error",
      },
    });
    return;
  }

  const usage = fakeUsage();
  const completionId = "chatcmpl_mock_" + Date.now();
  const created = Math.floor(Date.now() / 1000);

  if (!stream) {
    res.status(200).json({
      id: completionId,
      object: "chat.completion",
      created,
      model,
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: FAKE_RESPONSE_TEXT },
          finish_reason: "stop",
        },
      ],
      usage: {
        prompt_tokens: usage.input_tokens,
        completion_tokens: usage.output_tokens,
        total_tokens: usage.input_tokens + usage.output_tokens,
      },
    });
    return;
  }

  // --- Streaming (SSE), matching OpenAI's chunk shape ---

  res.socket?.setNoDelay(true);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (data: unknown) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  const baseChunk = {
    id: completionId,
    object: "chat.completion.chunk",
    created,
    model,
  };

  // First chunk announces the role, OpenAI-style.
  send({
    ...baseChunk,
    choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
  });

  const words = FAKE_RESPONSE_TEXT.split(" ");
  let i = 0;
  const interval = setInterval(() => {
    if (i >= words.length) {
      clearInterval(interval);

      // Finish-reason chunk.
      send({
        ...baseChunk,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      });

      // Usage-only chunk — empty choices array, only sent if the request
      // asked for it. This is the chunk Silvox's OpenAI adapter relies on.
      if (includeUsage) {
        send({
          ...baseChunk,
          choices: [],
          usage: {
            prompt_tokens: usage.input_tokens,
            completion_tokens: usage.output_tokens,
            total_tokens: usage.input_tokens + usage.output_tokens,
          },
        });
      }

      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }
    const chunk = (i === 0 ? "" : " ") + words[i];
    send({
      ...baseChunk,
      choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
    });
    i++;
  }, 20);

  res.on("close", () => clearInterval(interval));
});

app.listen(PORT, () => {
  console.log(`mock-provider listening on http://localhost:${PORT}`);
  console.log(
    `endpoints: POST /v1/messages (Anthropic), POST /v1/chat/completions (OpenAI)`,
  );
  console.log(
    `scenarios: default=success, header 'x-mock-scenario: error|hang'`,
  );
});
