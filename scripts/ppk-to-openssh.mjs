import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

function readString(buf, offset) {
  const len = buf.readUInt32BE(offset);
  offset += 4;
  return [buf.subarray(offset, offset + len), offset + len];
}

function readMpint(buf, offset) {
  const [raw, next] = readString(buf, offset);
  if (!raw.length) return [0n, next];
  return [BigInt("0x" + raw.toString("hex")), next];
}

function writeString(value) {
  const buf = Buffer.alloc(4 + value.length);
  buf.writeUInt32BE(value.length, 0);
  value.copy(buf, 4);
  return buf;
}

function writeMpint(value) {
  if (value === 0n) return writeString(Buffer.alloc(0));
  let hex = value.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  let raw = Buffer.from(hex, "hex");
  if (raw[0] & 0x80) raw = Buffer.concat([Buffer.from([0]), raw]);
  return writeString(raw);
}

function decodeLines(lines) {
  return Buffer.from(lines.join("").replace(/\s+/g, ""), "base64");
}

function parsePpk(path) {
  const content = readFileSync(path, "utf8").split(/\r?\n/);
  if (!content.some((line) => line.includes("Encryption: none"))) {
    throw new Error("Only unencrypted PPK files are supported.");
  }

  const publicStart = content.indexOf("Public-Lines: 6") + 1;
  const publicBlob = decodeLines(content.slice(publicStart, publicStart + 6));
  let offset = 0;
  let [keyType, next] = readString(publicBlob, offset);
  offset = next;
  if (keyType.toString() !== "ssh-rsa") throw new Error("Only ssh-rsa keys are supported.");

  const [exponentBytes, next2] = readString(publicBlob, offset);
  offset = next2;
  const exponent = BigInt("0x" + exponentBytes.toString("hex"));
  const [modulus, next3] = readMpint(publicBlob, offset);
  offset = next3;

  const privateStart = content.indexOf("Private-Lines: 14") + 1;
  const privateBlob = decodeLines(content.slice(privateStart, privateStart + 14));
  offset = 0;
  const [privateExponentBytes, p1] = readString(privateBlob, offset);
  offset = p1;
  const [primePBytes, p2] = readString(privateBlob, offset);
  offset = p2;
  const [primeQBytes, p3] = readString(privateBlob, offset);
  offset = p3;
  const [coefficientBytes] = readString(privateBlob, offset);

  const privateExponent = BigInt("0x" + privateExponentBytes.toString("hex"));
  const primeP = BigInt("0x" + primePBytes.toString("hex"));
  const primeQ = BigInt("0x" + primeQBytes.toString("hex"));
  const coefficient = BigInt("0x" + coefficientBytes.toString("hex"));

  if (primeP * primeQ !== modulus) throw new Error("PPK public and private key components do not match.");

  return { modulus, exponent, privateExponent, primeP, primeQ, coefficient };
}

function encodeOpenSshPrivateKey(parts, comment = "tms-deploy-key") {
  const { modulus, exponent, privateExponent, primeP, primeQ, coefficient } = parts;
  const publicBlob = Buffer.concat([
    writeString(Buffer.from("ssh-rsa")),
    writeMpint(exponent),
    writeMpint(modulus)
  ]);

  const check = randomBytes(4);
  let privateBlob = Buffer.concat([
    check,
    check,
    writeString(Buffer.from("ssh-rsa")),
    writeMpint(modulus),
    writeMpint(exponent),
    writeMpint(privateExponent),
    writeMpint(coefficient),
    writeMpint(primeP),
    writeMpint(primeQ),
    writeString(Buffer.from(comment))
  ]);

  const padLen = (8 - (privateBlob.length % 8)) % 8;
  if (padLen) {
    privateBlob = Buffer.concat([privateBlob, Buffer.from(Array.from({ length: padLen }, (_, i) => i + 1))]);
  }

  const payload = Buffer.concat([
    Buffer.from("openssh-key-v1\x00"),
    writeString(Buffer.from("none")),
    writeString(Buffer.from("none")),
    writeString(Buffer.alloc(0)),
    Buffer.from([0, 0, 0, 1]),
    writeString(publicBlob),
    writeString(privateBlob)
  ]);

  return `-----BEGIN OPENSSH PRIVATE KEY-----\n${payload
    .toString("base64")
    .match(/.{1,70}/g)
    .join("\n")}\n-----END OPENSSH PRIVATE KEY-----\n`;
}

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node ppk-to-openssh.mjs <input.ppk> <output.pem>");
  process.exit(1);
}

const parts = parsePpk(input);
const pem = encodeOpenSshPrivateKey(parts);
writeFileSync(output, pem, { mode: 0o600 });
console.log(`Wrote ${output}`);
