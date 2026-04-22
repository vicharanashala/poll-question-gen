const nlp = require('compromise');

const text = "Today we are going to learn about the React framework. It is a library built by Facebook for creating user interfaces. We will also discuss virtual dom and component state.";

const doc = nlp(text);

console.log("Nouns:", doc.nouns().out('array'));
console.log("Topics:", doc.topics().out('array'));
console.log("Terms:", doc.terms().out('array'));
