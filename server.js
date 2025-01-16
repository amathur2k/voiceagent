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
  
  // Get the first debtor's data (assuming row 2 contains the data, as row 1 has headers)
  const firstDebtor = rows[0];
  console.log('First Debtor Data:', firstDebtor); // Print the first debtor's data to the console
  
  return {
    name: firstDebtor.Name,
    outstandingDebt: firstDebtor['Outstanding Debt'], // Note: matches the column header exactly
    dueDate: firstDebtor['Due Date']
  };
}

// Replace the hard-coded variables with the function call
let name, outstandingDebt, dueDate;

try {
  const debtorData = await getDebtorData();
  name = debtorData.name;
  outstandingDebt = debtorData.outstandingDebt;
  dueDate = debtorData.dueDate;
} catch (error) {
  console.error('Error fetching data from Google Sheet:', error);
  // Fallback values in case of error
  name = "Prerna";
  outstandingDebt = "50,000";
  dueDate = "01/01/2025";
}

// Rewrite the SYSTEM_MESSAGE using variables
const SYSTEM_MESSAGE = `You are a polite but strict Debt Recovery Agent. 
Your primary job is to perform the following tasks:
1. Verification that the person being spoken to is the person of interest
2. Credit repayment discussion, providing options for a full repayment by the end of the week or refinancing options
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
