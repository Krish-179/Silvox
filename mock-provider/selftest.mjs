import { spawn } from "node:child_process";
import http from "node:http";

const server = spawn("npx", ["tsx", "server.ts"], { cwd: process.cwd() });
let serverLog = "";
server.stdout.on("data", (d) => (serverLog += d.toString()));
server.stderr.on("data", (d) => (serverLog += d.toString()));

function request(scenario, stream) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: "m", stream, messages: [] });
    const req = http.request(
      {
        hostname: "localhost",
        port: 4000,
        path: "/v1/messages",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          ...(scenario ? { "x-mock-scenario": scenario } : {}),
        },
        timeout: 4000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c.toString()));
        res.on("end", () => resolve({ status: res.statusCode, data }));
      }
    );
    req.on("timeout", () => {
      req.destroy();
      resolve({ status: "TIMEOUT", data: "" });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  await new Promise((r) => setTimeout(r, 1500)); // let server boot

  console.log("=== SUCCESS non-stream ===");
  console.log(await request(null, false));

  console.log("=== SUCCESS stream ===");
  console.log(await request(null, true));

  console.log("=== ERROR ===");
  console.log(await request("error", false));

  console.log("=== HANG (expect TIMEOUT after 4s) ===");
  console.log(await request("hang", false));

  server.kill(9);
  console.log("--- server log ---");
  console.log(serverLog);
}

main().catch((e) => {
  console.error("TEST FAILED:", e);
  server.kill(9);
  process.exit(1);
});
