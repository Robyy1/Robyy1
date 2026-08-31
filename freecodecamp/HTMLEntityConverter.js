function convertHTML(str) {
  let result = "";

  for (let char of str) {
    if (char === "&") {
      result += "&amp;";
    } else if (char === "<") {
      result += "&lt;";
    } else if (char === ">") {
      result += "&gt;";
    } else if (char === '"') {
      result += "&quot;";
    } else if (char === "'") {
      result += "&apos;";
    } else {
      result += char;
    }
  }

  return result;
}

// Test cases from your lab
console.log(convertHTML("Dolce & Gabbana"));
// Output: Dolce &amp; Gabbana

console.log(convertHTML("Hamburgers < Pizza < Tacos"));
// Output: Hamburgers &lt; Pizza &lt; Tacos

console.log(convertHTML('Stuff in "quotation marks"'));
// Output: Stuff in &quot;quotation marks&quot;
