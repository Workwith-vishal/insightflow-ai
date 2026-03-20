import { env } from "./config/env.js";
import { createServer } from "./http/server.js";
import { connectToDatabase } from "./storage/mongo.js";

const server = createServer();
const maxPortAttempts = 10;
let currentPort = env.port;
let attempts = 0;

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    attempts += 1;

    if (attempts >= maxPortAttempts) {
      console.error(
        `Unable to find an open port after trying ${maxPortAttempts} ports starting at ${env.port}.`,
      );
      process.exit(1);
    }

    currentPort += 1;
    console.warn(`Port ${currentPort - 1} is already in use. Retrying on port ${currentPort}...`);
    server.listen(currentPort);
    return;
  }

  console.error("Backend failed to start.", error);
  process.exit(1);
});

try {
  await connectToDatabase();
  console.log(`MongoDB connected: ${env.mongoUri}`);

  server.listen(currentPort, () => {
    console.log(`Backend server listening on http://localhost:${currentPort}`);
  });
} catch (error) {
  console.error("Failed to connect to MongoDB.", error);
  process.exit(1);
}
