function sumAll(array) {
  let sum = 0;
  let min = Math.min(array[0], array[1]);
  let max = Math.max(array[0], array[1]);
  for (let i = min; i <= max; i++) {
    sum += i;
  }
  return sum;
}
console.log(sumAll([5, 10]));
