import http from "node:http";

const port = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(
    JSON.stringify({
      message: "InsightFlow backend scaffold is running.",
    }),
  );
});

server.listen(port, () => {
  console.log(`Backend server listening on http://localhost:${port}`);
});
