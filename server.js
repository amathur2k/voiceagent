import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import fastifyEnv from "@fastify/env";
import { GoogleSpreadsheet } from 'google-spreadsheet';

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

// Add this function to get data from Google Sheet
async function getDebtorData() {
  const SPREADSHEET_ID = '1XQl4nbiwvM1jXnrfhLubfu6mMlJkIn-Q7KLN7ZkbWcQ';
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, {
    apiKey: process.env.GOOGLE_API_KEY
  });

  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  const rows = await sheet.getRows();
  
  // Find first row where toCall is True
  let debtorToCall = null;
  for (const row of rows) {
    const rawData = row._rawData;
    if (rawData[3]?.toLowerCase() === 'true') {  // Check if toCall (4th column) is True
      debtorToCall = row;
      break;
    }
  }
  
  if (!debtorToCall) {
    throw new Error('No debtors marked for calling found');
  }

  const rawData = debtorToCall._rawData;
  return {
    name: rawData[0],
    outstandingDebt: rawData[1],
    dueDate: rawData[2],
    toCall: rawData[3]
  };
}

// Replace the hard-coded variables with the function call


// Rewrite the SYSTEM_MESSAGE using variables
const SYSTEM_MESSAGE = `You are a polite but strict Debt Recovery Agent. 
Your primary job is to perform the following tasks:
1. Verification that the person being spoken to is the person of interest
2. Credit repayment discussion, providing options for a full repayment by the end of the week or refinancing options
3. Agreement or non-agreement of next steps
4. Closure of the call

In case of any questions, concerns, or objections, get a good time for a human to call back.
If asked, the agent’s identity is Agent Id 123 calling from ABC Bank.`;

// Server-side API route to return an ephemeral realtime session token
server.get("/token", async () => {
  // Get debtor data first
  let debtorInfo;
  try {
    debtorInfo = await getDebtorData();
    console.log('Debtor Data:', debtorInfo);
  } catch (error) {
    console.error('Error fetching debtor data:', error);
    // Fallback values
    debtorInfo = {
      name: "Spiderman",
      outstandingDebt: "50,000",
      dueDate: "01/01/2025"
    };
  }

  const r = await fetch("https://api.openai.com/v1/realtime/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-realtime-preview-2024-12-17",
      voice: "verse",
      instructions: SYSTEM_MESSAGE + 
        `You may assume you are calling ${debtorInfo.name} and their net outstanding debt is $${debtorInfo.outstandingDebt}, which was due on ${debtorInfo.dueDate}.`
    }),
  });

  return new Response(r.body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
});

// Add this after the existing /token endpoint
server.post("/summarize-conversation", async (request, reply) => {
  const events = request.body.events;
  console.log("[events]: ", events);
  
  // Filter and format conversation events
  const conversationEvents = events.filter(event => 
    (event.type === "conversation.item.create" && event.item?.type === "message") ||
    (event.type === "response.message.create")
  );

  const conversation = conversationEvents.map(event => {
    if (event.type === "conversation.item.create") {
      return {
        role: "user",
        content: event.item.content[0].text
      };
    } else {
      return {
        role: "assistant",
        content: event.response?.output?.[0]?.content || event.response?.message || ""
      };
    }
  });
  console.log("[conversation]: ", conversation);

  try {
    // Request summary from OpenAI
    const summaryResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4-turbo-preview",
        messages: [
          {
            role: "system",
            content: "Please provide a concise summary of the following conversation between a user and an AI assistant. Focus on the main topics discussed and key outcomes."
          },
          {
            role: "user",
            content: JSON.stringify(conversation)
          }
        ]
      })
    });

    const summaryData = await summaryResponse.json();
    const summary = summaryData.choices[0].message.content;
    
    console.log("\n=== Conversation Summary ===");
    console.log(summary);
    console.log("=========================\n");

    return { success: true, summary };
  } catch (error) {
    console.error("Error generating summary:", error);
    return reply.status(500).send({ error: "Failed to generate summary" });
  }
});
await server.listen({ port: process.env.PORT || 3000 });
