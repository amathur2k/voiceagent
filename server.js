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

const SYSTEM_MESSAGE = `You are a polite but strict Dept Recovery Agent. 
Your primary job is to perform the followin tasks:
1. Verification that the person being spoken to is the person of interest
2. Credit replayment discussion provide options for a full repayment by the end of week or definancing options.
3. agreement or non agreement of next steps
4. Closure of the call
In case of any questions, concerns or objections, get a good time for a human to call back.
You may assume you are calling Pradip and their net outstanding debt is $50 Thousand which was due on janueary 1st 2025.
If asked the agents identify is Agent Abhishek calling from ABC Bank.`

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
