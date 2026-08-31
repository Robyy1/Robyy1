function pyramid(vertex, int, isDown) {
  let pyramid = "";
  if (isDown) {
    spaceCount = 0;
    vertexCount = int * 2 - 1;
  } else {
    let vertexCount = 1;
    let spaceCount = int;
  }

  for (let i = 1; i <= int; i++) {
    if (isDown === false) {
      pyramid += `${" ".repeat(spaceCount)}${vertex.repeat(vertexCount)}\n`;
      spaceCount--;
      vertexCount += 2;
    } else {
      pyramid += `${" ".repeat(spaceCount)}${vertex.repeat(vertexCount)}\n`;
      spaceCount++;
      vertexCount -= 2;
    }
  }
  return pyramid;
}

console.log(pyramid("x", 9, true));
