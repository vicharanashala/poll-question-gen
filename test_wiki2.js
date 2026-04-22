const axios = require("axios");

async function run() {
    try {
        const topic = "microservices";
        const headers = { 'User-Agent': 'SpandanApp/1.0 (contact@example.com)' };
        const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&utf8=&format=json`, { timeout: 5000, headers });
        console.log("Search Res Status:", searchRes.status);
        
        const bestTitle = searchRes.data.query.search[0].title;
        console.log("bestTitle:", bestTitle);
        const wikiRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`, { timeout: 5000, headers });
        console.log("Wiki Res Extract:", wikiRes.data.extract.substring(0, 50));
    } catch (err) {
        console.error("ERROR:", err.message);
    }
}
run();
