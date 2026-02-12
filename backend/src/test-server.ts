import Fastify from "fastify";
import cors from "fastify-cors";
import * as dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

console.log("All imports successful!");

const server = Fastify({ logger: true });
const PORT = parseInt(process.env.PORT || "8080");

server.get("/", async () => {
  return { message: "Test server running!" };
});

async function startServer() {
  try {
    const address = await server.listen({ port: PORT, host: "0.0.0.0" });
    console.log(`Test server running on ${address}`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

startServer();
