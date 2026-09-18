async function runTurns() {
  const baseUrl = 'http://localhost:5000/api';

  console.log("=== TURN 1 ===");
  let res = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'My rainfall is low.' })
  });
  let data = await res.json();
  console.log("Response:", JSON.stringify(data.reply, null, 2));
  console.log("Context:", JSON.stringify(data.context, null, 2));

  const conversationId = data.conversationId;

  console.log("\n=== TURN 2 ===");
  res = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Also soil.organicCarbon = 0.8', conversationId })
  });
  data = await res.json();
  console.log("Response:", JSON.stringify(data.reply, null, 2));
  console.log("Context:", JSON.stringify(data.context, null, 2));

  console.log("\n=== TURN 3 ===");
  res = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Also species richness is 5.', conversationId })
  });
  data = await res.json();
  console.log("Response:", JSON.stringify(data.reply, null, 2));
  console.log("Context:", JSON.stringify(data.context, null, 2));

  console.log("\n=== TURN 4 ===");
  res = await fetch(`${baseUrl}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Hello!', conversationId })
  });
  data = await res.json();
  console.log("Response:", JSON.stringify(data.reply, null, 2));
  console.log("Context:", JSON.stringify(data.context, null, 2));
}

runTurns().catch(console.error);
