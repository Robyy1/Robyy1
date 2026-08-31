function pairElement(str) {
  let dna = [];
  for (let i = 0; i < str.length; i++) {
  if (str[i] === "A") {
    dna.push(["A", "T"])
  } else if (str[i] === "T") {
    dna.push(["T", "A"])
  } else if (str[i] === "C") {
    dna.push(["C", "G"])
  } else if (str[i] === "G") {
    dna.push(["G", "C"])
  
  
}
  }
  return dna;
}
console.log(pairElement("AFTG")); 