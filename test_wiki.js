const axios = require("axios");

async function testWiki(topic) {
  try {
     console.log("Searching for:", topic);
     const searchRes = await axios.get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&utf8=&format=json`);
     if (searchRes.data && searchRes.data.query && searchRes.data.query.search.length > 0) {
        const bestTitle = searchRes.data.query.search[0].title;
        console.log("Found Title:", bestTitle);
        const wikiRes = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`);
        
        const extract = wikiRes.data.extract;
        console.log("Extract:", extract);
        
        const sentences = extract.match(/[^.!?]+[.!?]+/g) || [];
        console.log("Sentences length:", sentences.length);
        
        for (let i = 0; i < Math.min(3, sentences.length); i++) {
            const s = sentences[i].trim();
            if (s.length > 25) {
                let targetWord = bestTitle.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
                const topicRegex = new RegExp(`\\b${targetWord}\\b`, 'gi');
                let blankedSentence = s.replace(topicRegex, '_____');
                
                if (blankedSentence === s) {
                   const sWords = s.split(/[\s,]+/).filter(w => w.length > 5);
                   if (sWords.length > 0) {
                      targetWord = sWords.sort((a,b) => b.length - a.length)[0].replace(/[^a-zA-Z0-9]/g, '');
                      blankedSentence = s.replace(new RegExp(`\\b${targetWord}\\b`, 'gi'), '_____');
                   }
                }
                
                if (blankedSentence !== s && targetWord.length > 2) {
                   console.log("Success generated Q:", blankedSentence);
                } else {
                   console.log("Failed blanking on:", s, "| targetWord:", targetWord, "| blanked !== s?", blankedSentence !== s, "| target.length:", targetWord.length);
                }
            } else {
               console.log("Sentence too short:", s);
            }
        }
     } else {
        console.log("No search results found");
     }
  } catch(e) {
     console.error(e.message);
  }
}

testWiki("microservices");
testWiki("frontend");
