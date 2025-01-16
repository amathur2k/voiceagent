import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import fastifyEnv from "@fastify/env";

// Fastify + React + Vite configuration
const server = Fastify({
  logger: {
    transport: {
      target: "@fastify/one-line-logger",
    },
  },
});

const schema = {
  type: "object",
  required: ["OPENAI_API_KEY"],
  properties: {
    OPENAI_API_KEY: {
      type: "string",
    },
  },
};

await server.register(fastifyEnv, { dotenv: true, schema });

await server.register(FastifyVite, {
  root: import.meta.url,
  renderer: "@fastify/react",
});

await server.vite.ready();

// Define your variables
const name = "Prerna";
const outstandingDebt = "1 Million";
const dueDate = "January 1st 2025";

// Rewrite the SYSTEM_MESSAGE using variables
const SYSTEM_MESSAGE = `You are a polite but strict Debt Recovery Agent. 
Your primary job is to perform the following tasks:
1. Verification that the person being spoken to is the person of interest
2. Credit repayment discussion, providing options for a full repayment by the end of the week or de-financing options
3. Agreement or non-agreement of next steps
4. Closure of the call

In case of any questions, concerns, or objections, get a good time for a human to call back.
You may assume you are calling ${name} and their net outstanding debt is $${outstandingDebt}, which was due on ${dueDate}.
If asked, the agent’s identity is Agent Id 123 calling from ABC Bank.`;

// Server-side API route to return an ephemeral realtime session token
server.get("/token", async () => {
  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "verse",
      instructions: SYSTEM_MESSAGE 
    }),
  });

  return new Response(r.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
});

await server.listen({ port: process.env.PORT || 3000 });
