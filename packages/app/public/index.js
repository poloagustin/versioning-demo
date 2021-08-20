console.log("the app");
fetch("./package.json")
  .then((response) => response.json())
  .then(
    (packageJson) =>
      (document.getElementById(
        "main"
      ).innerText = `Version: ${packageJson.version}`)
  );
