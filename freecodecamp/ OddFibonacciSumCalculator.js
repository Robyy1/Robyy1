function sumFibs(number) {
  let a = 1;
  let b = 1;
  let sum = 0;

  while (a <= number) {
    if (a % 2 !== 0) {
      sum += a;
    }
    const next = a + b;
    a = b;
    b = next;
  }

  return sum;
}
console.log(sumFibs(4));
