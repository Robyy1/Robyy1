<<<<<<< HEAD
function generatePassword(length) {
  let characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += characters[Math.floor(Math.random() * characters.length)];
  }
  return password;
}
let password = generatePassword(6);
console.log(`Generated password: ${password}`);
=======
function bouncer(array){
  let array1 = array.splice()
  for(let i = 0; i <= array1.length; i++){
    array1[i].bool()
  }
}

console.log(bouncer([7, "ate", "", false, 9]))
>>>>>>> 56f6e8dae9682d333f7e7378be607d8953c83f7a
