function dropElements(arr, func) {
  for (let i = 0; i < arr.length; i++) {
    // 1. Check if the current element passes the test
    if (func(arr[i])) {
      // 2. If true, return the rest of the array starting from this index
      return arr.slice(i);
    }
  }
  // 3. If loop finishes without success, return empty array
  return [];
}
