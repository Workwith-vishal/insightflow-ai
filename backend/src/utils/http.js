export const json = (res, statusCode, payload) => {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(payload));
};

export const sendEmpty = (res, statusCode) => {
  res.writeHead(statusCode);
  res.end();
};

export const notFound = (res) => {
  json(res, 404, { error: "Not Found" });
};

export const methodNotAllowed = (res, allowedMethods) => {
  res.writeHead(405, {
    "Content-Type": "application/json; charset=utf-8",
    Allow: allowedMethods.join(", "),
  });
  res.end(JSON.stringify({ error: "Method Not Allowed" }));
};

export const readJsonBody = async (req) => {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw);
};
