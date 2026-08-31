function pairElement(str) {
  let dna = [];

  for (let i = 0; i < str.length; i++) {
    let char = str[i];
    let pair = "";

    if (char === "A") {
      pair = "T";
    } else if (char === "T") {
      pair = "A";
    } else if (char === "C") {
      pair = "G";
    } else if (char === "G") {
      pair = "C";
    }

    dna.push([char, pair]);
  }

  return dna;
}

console.log(pairElement("ATCGA"));
