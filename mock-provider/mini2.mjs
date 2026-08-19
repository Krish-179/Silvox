import express from "express";
const app = express();
app.use(express.json());
app.post("/stream", (req, res) => {
  console.log("got body", req.body);
  res.writeHead(200, { "Content-Type": "text/event-stream" });
  let i = 0;
  const t = setInterval(() => {
    console.log("tick", i);
    res.write(`data: ${i}\n\n`);
    i++;
    if (i > 5) { clearInterval(t); res.end(); }
  }, 20);
});
app.listen(4002, () => console.log("mini2 listening 4002"));
