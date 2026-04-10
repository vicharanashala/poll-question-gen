const fs = require("fs");
const parser = require("@babel/parser");
const file = fs.readFileSync("frontend/src/pages/student/StudentPollRoom.tsx", "utf8");
let start = 0;
let end = file.length;
let firstFail = null;
for (let i = 1; i <= 20; i++) {
  const len = Math.floor(file.length * i / 20);
  try {
    parser.parse(file.slice(0, len), { sourceType: "module", plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"] });
  } catch (e) {
    firstFail = len; start = 0; end = len; console.log("firstFail", len); break;
  }
}
while (end - start > 10) {
  const mid = Math.floor((start + end) / 2);
  try {
    parser.parse(file.slice(0, mid), { sourceType: "module", plugins: ["typescript", "jsx", "decorators-legacy", "classProperties"] });
    start = mid;
  } catch (e) {
    end = mid;
  }
}
console.log("range", start, end);
console.log(file.slice(Math.max(0, start - 200), Math.min(file.length, end + 200)));
