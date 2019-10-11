const childProcess = require("child_process");
const del = require("del");
const fs = require("fs-extra");
const { promisify } = require("util");

const exec = promisify(childProcess.exec);

async function build() {
  await del("dist");
  await exec("tsc");
  await fs.copy("src/type", "dist/type");
}

build();
