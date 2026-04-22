const axios = require("axios");
const fs = require("fs");

async function testGeneration(topic) {
  let output = `\n=== RESULTS FOR: ${topic} ===\n`;
  try {
    const res = await axios.post("http://localhost:5000/api/generate-questions", {
      sessionId: "test-session",
      text: topic
    });
    res.data.questions.forEach((q, i) => {
      output += `\nQ${i+1}: ${q.text}\n`;
      output += `Options: ${q.options.join(", ")}\n`;
      output += `Correct: ${q.correctAnswer}\n`;
    });
  } catch (err) {
    output += `Error for ${topic}: ${err.message}\n`;
  }
  return output;
}

async function runAll() {
  let finalOut = "";
  finalOut += await testGeneration("react"); 
  finalOut += await testGeneration("microservices"); 
  finalOut += await testGeneration("asdfqwerzxcvbnm"); 
  fs.writeFileSync("test_output2.txt", finalOut, "utf-8");
}

runAll();
